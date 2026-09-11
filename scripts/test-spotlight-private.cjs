// Runs the real Prisma services and Next routes in a fresh source copy. No app
// env files, external DB arguments, published ports, or persistent DB storage.
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const crypto = require('node:crypto'), assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const root = path.resolve(__dirname, '..'), nonce = crypto.randomBytes(16).toString('hex');
const name = 'folio-private-' + nonce, database = 'private_' + nonce.slice(0, 12);
const base = Object.fromEntries(Object.entries(process.env).filter(([k]) => /^(PATH|HOME|TMPDIR|TEMP|TMP)$/i.test(k)));
const evidence = { status: 'running', applicationDatabaseContacted: false, startedAt: new Date().toISOString(), commands: [] };
let scratch, socket, container, context, env;
function run(exe, args, options = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(exe, args, { cwd: scratch || root, env: options.env || base, windowsHide: true, stdio: ['pipe','pipe','pipe'] });
    let stdout = '', stderr = ''; const timer = setTimeout(() => p.kill(), options.timeout || 180000);
    p.on('error', reject); p.stdout.on('data', b => stdout += b); p.stderr.on('data', b => stderr += b);
    p.stdin.on('error', () => {}); p.stdin.end(options.input || '');
    p.on('close', code => { clearTimeout(timer); resolve({ code, stdout, stderr }); });
  });
}
async function docker(args, options) { const r = await run('docker', context ? ['--context', context, ...args] : args, options); assert.equal(r.code, 0, r.stderr); return r.stdout.trim(); }
async function verify() {
  assert.match(container, /^[a-f0-9]{64}$/); const [c] = JSON.parse(await docker(['inspect', container]));
  assert.equal(c.Id, container); assert.equal(c.Name, '/' + name); assert.equal(c.Config.Labels['folio.private-test'], nonce);
  assert.equal(c.HostConfig.NetworkMode, 'none'); assert.equal(c.HostConfig.Privileged, false); assert.equal(Object.keys(c.HostConfig.PortBindings || {}).length, 0);
  const mounts = c.Mounts.filter(m => m.Type !== 'tmpfs'); assert.equal(mounts.length, 1); assert.equal(mounts[0].Source, socket); assert.equal(mounts[0].Destination, '/test-socket');
  assert.equal(c.Config.Image, 'postgres:17'); return c;
}
async function sql(input) { await verify(); return docker(['exec','-i',container,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-h','/test-socket','-U','postgres','-d',database],{input}); }
async function tool(label, args, timeout) {
  await verify();
  for (const k of ['DATABASE_URL','DIRECT_URL','SHADOW_DATABASE_URL']) { const u = new URL(env[k]); assert.equal(u.hostname,'localhost'); assert.equal(u.searchParams.get('host'),socket); assert.equal(u.pathname,'/'+database); }
  const r = await run(process.execPath,args,{env,timeout});
  evidence.commands.push({ label, code: r.code, output: (r.stdout+r.stderr).replace(/postgres(?:ql)?:\/\/[^\s"']+/g,'[isolated connection]') });
  assert.equal(r.code,0,evidence.commands.at(-1).output); console.log('PASS '+label); return r.stdout;
}
async function main() {
  assert.equal(process.platform,'linux','Requires authorized Linux Docker/CI'); assert.equal(process.argv.length,2,'External targets are not accepted');
  context = await docker(['context','show']); const [ctx] = JSON.parse(await docker(['context','inspect',context])); assert.match(ctx.Endpoints.docker.Host,/^unix:\/\//);
  scratch = fs.mkdtempSync(path.join(os.tmpdir(),'folio-private-')); socket = path.join(scratch,'socket'); fs.mkdirSync(socket); fs.chmodSync(socket,0o777);
  for (const p of ['src','scripts','prisma','public']) fs.cpSync(path.join(root,p),path.join(scratch,p),{recursive:true});
  for (const p of ['package.json','package-lock.json','tsconfig.json','next.config.js','middleware.ts','tailwind.config.ts','postcss.config.js']) if(fs.existsSync(path.join(root,p))) fs.copyFileSync(path.join(root,p),path.join(scratch,p));
  fs.mkdirSync(path.join(scratch,'tasks')); fs.symlinkSync(path.join(root,'node_modules'),path.join(scratch,'node_modules'),'dir');
  assert.ok(!fs.readdirSync(scratch).some(p=>p.startsWith('.env')));
  const url = `postgresql://postgres@localhost:5432/${database}?host=${encodeURIComponent(socket)}&schema=public&connection_limit=8`;
  env = { ...base, DATABASE_URL:url,DIRECT_URL:url,SHADOW_DATABASE_URL:url,FOLIO_TEST_NONCE:nonce,FOLIO_TEST_DATABASE:database,
    NEXTAUTH_SECRET:crypto.randomBytes(32).toString('hex'),NEXTAUTH_URL:'http://127.0.0.1:3210',NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:9',NEXT_PUBLIC_SUPABASE_ANON_KEY:'synthetic-only',
    SPOTLIGHT_INTERVIEW_V1:'true',SPOTLIGHT_PROJECT_IDS:Array.from({length:8},(_,i)=>`00000000-0000-4000-8000-${String(i+100).padStart(12,'0')}`).join(','),SPOTLIGHT_ACTOR_IDS:'00000000-0000-4000-8000-000000000001,00000000-0000-4000-8000-000000000002',
    NEXT_TELEMETRY_DISABLED:'1',NODE_OPTIONS:'--max-old-space-size=4096',CI:'true' };
  await docker(['pull','postgres:17'],{timeout:300000});
  container = await docker(['run','-d','--name',name,'--label',`folio.private-test=${nonce}`,'--network','none','--tmpfs','/var/lib/postgresql/data:rw','--mount',`type=bind,src=${socket},dst=/test-socket`,'-e','POSTGRES_HOST_AUTH_METHOD=trust','-e',`POSTGRES_DB=${database}`,'postgres:17','-c','listen_addresses=','-c','unix_socket_directories=/var/run/postgresql,/test-socket']);
  const c = await verify(); evidence.isolation={network:'none',ports:0,persistentDataMounts:0,privateSocket:true,imageId:c.Image};
  for(let i=0;i<80;i++){const ready=await run('docker',['--context',context,'exec',container,'pg_isready','-h','/test-socket','-U','postgres','-d',database]);const pid=await docker(['exec',container,'cat','/proc/1/comm']);if(ready.code===0&&pid==='postgres')break;await new Promise(r=>setTimeout(r,500));}
  await sql(`ALTER DATABASE ${database} SET folio.test_nonce='${nonce}';`);
  env.FOLIO_TEST_SYSTEM_ID = await sql('SELECT system_identifier::text FROM pg_control_system()');
  const prisma = path.join(root,'node_modules/prisma/build/index.js');
  await tool('Prisma client generation',[prisma,'generate','--schema','prisma/schema.prisma']);
  const ddl = await tool('Synthetic prerequisite DDL generation',[prisma,'migrate','diff','--from-empty','--to-schema-datamodel','prisma/schema.prisma','--script']);
  // Unused vector columns have a TEXT fixture stand-in (plain PostgreSQL 17).
  // All four spotlight tables come solely from the reviewed SQL, including CHECKs.
  const prerequisites = ddl.split(/;\s*\n/).filter(s=>! /"(?:product_spotlights|product_spotlight_tags|spotlight_questions|spotlight_answer_revisions)"/.test(s)).join(';\n').replace(/\bvector(?:\(\d+\))?/g,'TEXT');
  await sql(prerequisites);
  for(const [dir,hash] of [['20260910180000_add_product_spotlight_draft_selection','77fa2afe19f2f1e61d344f54d78381ca18d862b795e48edca9b3101c939291ab'],['20260910210000_add_spotlight_durable_interview','50adeaf12a7b402181769746caed685ba3c0a5b58821528f83cffa397e5e2c10']]) {
    const migration=fs.readFileSync(path.join(root,'prisma/migrations',dir,'migration.sql'),'utf8').replace(/\r\n/g,'\n'); assert.equal(crypto.createHash('sha256').update(migration).digest('hex'),hash); await sql(migration); evidence[dir]=hash;
  }
  await tool('Real services, privacy readers and concurrency',[path.join(root,'node_modules/tsx/dist/cli.mjs'),'scripts/spotlight-private/service.test.ts'],300000);
  await tool('Real Next API and Chromium save/restart/resume journey',[path.join(root,'node_modules/tsx/dist/cli.mjs'),'scripts/spotlight-private/browser.test.ts'],600000);
  evidence.status='passed';
}
main().catch(e=>{evidence.status=container?'failed':'blocked';evidence.error=e.message;process.exitCode=1;console.error(e.message);}).finally(async()=>{
  if(scratch) for(const file of ['spotlight-private-services.json','spotlight-private-browser.json','spotlight-private-browser.png']) {const from=path.join(scratch,'tasks',file);if(fs.existsSync(from))fs.copyFileSync(from,path.join(root,'tasks',file));}
  if(container)try{await verify();await docker(['rm','-f','-v',container]);evidence.disposableContainerRemoved=true;}catch(e){evidence.cleanupError=e.message;process.exitCode=1;}
  if(scratch&&(!container||evidence.disposableContainerRemoved)){assert.ok(path.resolve(scratch).startsWith(path.resolve(os.tmpdir())+path.sep+'folio-private-'));fs.rmSync(scratch,{recursive:true,force:true});}
  evidence.finishedAt=new Date().toISOString();fs.writeFileSync(path.join(root,'tasks/spotlight-private-results.json'),JSON.stringify(evidence,null,2)+'\n');
});
