// Linux/CI only: exercise the repository's actual npm migration chain separately
// from direct SQL tests. PostgreSQL has no network or TCP listener. Prisma uses
// a Unix socket in a freshly created private temp directory, never an app URL.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const migrationName = '20260910180000_add_product_spotlight_draft_selection';
const expectedHash = '77fa2afe19f2f1e61d344f54d78381ca18d862b795e48edca9b3101c939291ab';
const sqlFile = fs.readFileSync(path.join(root, 'prisma/migrations', migrationName, 'migration.sql'));
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const nonce = crypto.randomBytes(16).toString('hex');
const database = `spotlight_command_${nonce.slice(0, 8)}`;
const name = `folio-spotlight-command-${nonce}`;
const baseEnv = Object.fromEntries(Object.entries(process.env).filter(([k]) => /^(PATH|HOME|TMPDIR|TEMP|TMP)$/i.test(k)));
const evidence = { status: 'running', migrationName, expectedHash, tests: [], commandLogs: [], applicationDatabaseContacted: false, startedAt: new Date().toISOString() };
let scratch, socket, container, context, boundEnv;
function run(exe, args, { input = '', cwd = scratch || root, env = baseEnv, timeout = 120000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(exe, args, { cwd, env, windowsHide: true, stdio: ['pipe','pipe','pipe'] });
    let stdout = '', stderr = '';
    const timer = setTimeout(() => child.kill(), timeout);
    child.on('error', error => { clearTimeout(timer); reject(error); });
    child.stdout.on('data', s => { stdout += s; }); child.stderr.on('data', s => { stderr += s; });
    child.stdin.on('error', () => {});
    child.on('close', (code, signal) => { clearTimeout(timer); resolve({ code, signal, stdout, stderr }); });
    child.stdin.end(input);
  });
}
const docker = (args, options) => run('docker', context ? ['--context',context,...args] : args, options);
async function ok(args, options) {
  const r = await docker(args, options); assert.equal(r.code, 0, r.stderr); return r.stdout.trim();
}
async function verify() {
  assert.match(container, /^[a-f0-9]{64}$/);
  const [c] = JSON.parse(await ok(['inspect',container]));
  assert.equal(c.Id, container); assert.equal(c.Name, '/' + name);
  assert.equal(c.Config.Labels['folio.spotlight.command-test'], nonce);
  assert.equal(c.HostConfig.NetworkMode, 'none'); assert.equal(c.HostConfig.Privileged, false);
  assert.equal(Object.keys(c.HostConfig.PortBindings || {}).length, 0);
  const binds = c.Mounts.filter(m => m.Type !== 'tmpfs');
  assert.equal(binds.length, 1); assert.equal(binds[0].Type, 'bind');
  assert.equal(binds[0].Source, socket); assert.equal(binds[0].Destination, '/test-socket');
  assert.equal(c.Config.Image, 'postgres:17');
  return c;
}
async function sql(text) {
  await verify();
  return ok(['exec','-i',container,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-h','/test-socket','-U','postgres','-d',database], { input: text });
}
function assertTarget(env, { negativeGuard = false } = {}) {
  for (const key of ['DATABASE_URL','DIRECT_URL','SHADOW_DATABASE_URL']) {
    if (negativeGuard && key === 'DIRECT_URL' && !env[key]) continue;
    const u = new URL(env[key]);
    assert.equal(u.protocol, 'postgresql:'); assert.equal(u.hostname, 'localhost');
    assert.equal(u.username, 'postgres'); assert.equal(u.password, '');
    assert.equal(u.searchParams.get('host'), socket);
    assert.equal(u.searchParams.get('schema'), 'public');
    assert.deepEqual([...u.searchParams.keys()].sort(), ['host','schema']);
    assert.ok(u.port === '5432' || (negativeGuard && key === 'DATABASE_URL' && u.port === '6543'));
    assert.ok(u.pathname === '/' + database || (negativeGuard && key === 'DATABASE_URL' && u.pathname === '/wrong_synthetic_database'));
  }
}
const prismaBin = path.join(root, 'node_modules/prisma/build/index.js');
let npmBin;
async function tool(label, exe, args, { env = boundEnv, input = '', negativeGuard = false, code = 0 } = {}) {
  assertTarget(env, { negativeGuard }); await verify();
  const r = await run(exe, args, { env, input });
  const output = (r.stdout + r.stderr).replace(/postgres(?:ql)?:\/\/[^\s"']+/g, '[redacted synthetic connection]');
  evidence.commandLogs.push({ label, code: r.code, output });
  if (code === 0) assert.equal(r.code, 0, output);
  else assert.notEqual(r.code, 0, `${label} should fail`);
  return output;
}
const npm = (script, options) => tool(`npm run ${script}`, process.execPath, [npmBin,'run',script], options);
const status = options => tool('prisma migrate status', process.execPath, [prismaBin,'migrate','status'], options);
async function proveBinding() {
  const identity = await sql("SELECT system_identifier::text FROM pg_control_system()");
  const assertion = `DO $$ BEGIN IF current_database() <> '${database}' OR current_setting('folio.test_nonce') <> '${nonce}' OR (SELECT system_identifier::text FROM pg_control_system()) <> '${identity}' OR inet_server_addr() IS NOT NULL THEN RAISE EXCEPTION 'Disposable target binding failed'; END IF; END $$;`;
  await tool('Prisma engine target-binding assertion', process.execPath, [prismaBin,'db','execute','--stdin','--schema','prisma/schema.prisma'], { input: assertion });
}
async function test(label, fn) { await fn(); evidence.tests.push({ label, result: 'passed' }); console.log('PASS ' + label); }
const write = (rel, body) => { const p = path.join(scratch,rel); fs.mkdirSync(path.dirname(p),{recursive:true}); fs.writeFileSync(p,body); };
async function main() {
  assert.equal(process.platform, 'linux', 'Requires Linux local Docker (existing Ubuntu CI is supported)');
  assert.equal(process.argv.length, 2, 'No externally supplied target arguments accepted');
  assert.equal(sha(sqlFile.toString().replace(/\r\n/g,'\n')), expectedHash);
  context = await ok(['context','show']);
  const [ctx] = JSON.parse(await ok(['context','inspect',context]));
  assert.match(ctx.Endpoints.docker.Host, /^unix:\/\//, 'Only a local Docker Unix socket is allowed');
  await ok(['info','--format','{{.ServerVersion}}']);
  scratch = fs.mkdtempSync(path.join(os.tmpdir(),'folio-spotlight-command-'));
  socket = path.join(scratch,'socket'); fs.mkdirSync(socket); fs.chmodSync(socket,0o777);
  assert.ok(socket.length < 90, 'Keep Unix socket path within OS limits');
  fs.symlinkSync(path.join(root,'node_modules'),path.join(scratch,'node_modules'),'dir');
  const scripts = JSON.parse(fs.readFileSync(path.join(root,'package.json'))).scripts;
  assert.equal(scripts['migrate:deploy'], 'npm run db:guard && prisma migrate deploy');
  write('package.json',JSON.stringify({ name:'spotlight-command-fixture',private:true,scripts: { 'migrate:deploy':scripts['migrate:deploy'],'db:guard':scripts['db:guard'] } }));
  for (const p of ['prisma/schema.prisma','scripts/guard-migrations.ts','scripts/lib/migrationConnection.mjs','scripts/lib/loadEnv.mjs']) write(p,fs.readFileSync(path.join(root,p)));
  write('prisma/migrations/migration_lock.toml','provider = "postgresql"\n');
  write('prisma/migrations/20000101000000_synthetic_prerequisites/migration.sql',fs.readFileSync(path.join(__dirname,'spotlight-postgres/fixtures.sql')));
  // No app env files/configuration are copied. Explicit inherited values must win
  // over these deliberately wrong, credential-free synthetic file targets.
  write('.env','DATABASE_URL=postgresql://synthetic@application.invalid/never_connect\nDIRECT_URL=postgresql://synthetic@application.invalid/never_connect\n');
  write('.env.local','DATABASE_URL=postgresql://synthetic@other.invalid/never_connect\nDIRECT_URL=postgresql://synthetic@other.invalid/never_connect\n');
  write('.npmrc','update-notifier=false\naudit=false\nfund=false\n');
  npmBin = path.join(path.dirname(process.execPath),'node_modules/npm/bin/npm-cli.js');
  if (!fs.existsSync(npmBin)) npmBin=fs.realpathSync(path.join(path.dirname(process.execPath),'npm'));
  assert.ok(fs.existsSync(npmBin), 'Resolve npm CLI belonging to the installed Node runtime');
  const url = `postgresql://postgres@localhost:5432/${database}?host=${encodeURIComponent(socket)}&schema=public`;
  boundEnv = { ...baseEnv, DATABASE_URL:url,DIRECT_URL:url,SHADOW_DATABASE_URL:url,
    NPM_CONFIG_USERCONFIG:path.join(scratch,'.npmrc'),NPM_CONFIG_CACHE:path.join(scratch,'npm-cache'),CI:'true' };
  assertTarget(boundEnv);
  await test('External URL, foreign socket and wrong database rejected before command execution', async () => {
    for (const bad of ['postgresql://synthetic@application.invalid/never_connect',url.replace(encodeURIComponent(socket),'/another/socket'),url.replace(database,'wrong_database')]) {
      assert.throws(() => assertTarget({ ...boundEnv,DIRECT_URL:bad }));
    }
  });
  if ((await docker(['image','inspect','postgres:17'])).code !== 0) await ok(['pull','postgres:17'],{timeout:300000});
  container = await ok(['run','-d','--name',name,'--label',`folio.spotlight.command-test=${nonce}`,'--network','none',
    '--tmpfs','/var/lib/postgresql/data:rw','--mount',`type=bind,src=${socket},dst=/test-socket`,
    '-e','POSTGRES_HOST_AUTH_METHOD=trust','-e',`POSTGRES_DB=${database}`,'postgres:17','-c','listen_addresses=','-c','unix_socket_directories=/test-socket']);
  const c = await verify();
  evidence.isolation = { localDockerSocket:true,network:'none',tcpListener:false,ports:0,hostDataMounts:0,privateTemporarySocketMount:1,imageId:c.Image };
  let ready = false;
  for (let i=0;i<60;i++) {
    const pid = await docker(['exec',container,'cat','/proc/1/comm']);
    const pg = await docker(['exec',container,'pg_isready','-h','/test-socket','-U','postgres','-d',database]);
    if (pid.stdout.trim() === 'postgres' && pg.code === 0) { ready=true; break; }
    await new Promise(resolve=>setTimeout(resolve,500));
  }
  assert.ok(ready,'Final PostgreSQL server must be ready');
  await sql(`ALTER DATABASE ${database} SET folio.test_nonce='${nonce}';`);
  await test('Prisma migration engine binds to the verified socket, nonce, database and server identity', proveBinding);
  await test('Actual repository migration chain bootstraps synthetic prerequisites', async () => {
    await npm('migrate:deploy');
    assert.equal(await sql('SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL'),'1');
  });
  write(`prisma/migrations/${migrationName}/migration.sql`,sqlFile);
  await test('Pending status and guard name exactly the reviewed migration', async () => {
    const pending = await status({code:1}); assert.ok(pending.includes(migrationName));
    const guard = await npm('db:guard'); assert.ok(guard.includes('1 pending')); assert.ok(guard.includes(migrationName));
  });
  await test('An extra pending migration is surfaced, not hidden by the guard', async () => {
    const relativeDir='prisma/migrations/20260910180100_synthetic_extra';
    write(relativeDir+'/migration.sql','CREATE TABLE synthetic_extra(id TEXT PRIMARY KEY);');
    const output=await npm('db:guard'); assert.ok(output.includes('2 pending') && output.includes('20260910180100_synthetic_extra'));
    // Never apply the extra fixture. Delete only this verified scratch subfolder.
    const target=path.resolve(scratch,relativeDir); assert.ok(target.startsWith(scratch+path.sep)); fs.rmSync(target,{recursive:true});
  });
  await test('Guard rejects mismatched database names within the same disposable socket', async () => {
    const output=await npm('db:guard',{env:{...boundEnv,DATABASE_URL:url.replace(database,'wrong_synthetic_database')},negativeGuard:true,code:1});
    assert.ok(output.includes('Migrating one while the app reads the other'));
  });
  await test('Guard rejects transaction-pooled fallback before migration', async () => {
    const env={...boundEnv,DATABASE_URL:url.replace(':5432/',':6543/'),DIRECT_URL:''};
    const output=await npm('db:guard',{env,negativeGuard:true,code:1}); assert.ok(output.includes('transaction-pooled'));
  });
  await test('Same inherited target overrides both env files; guarded npm deploy applies exact SQL', async () => {
    await proveBinding(); const output=await npm('migrate:deploy'); assert.ok(output.includes(migrationName));
    assert.equal(await sql(`SELECT count(*) FROM _prisma_migrations WHERE migration_name='${migrationName}' AND finished_at IS NOT NULL AND rolled_back_at IS NULL AND checksum='${sha(sqlFile)}'`),'1');
    evidence.catalog=JSON.parse(await sql(fs.readFileSync(path.join(__dirname,'spotlight-postgres/catalog.sql'),'utf8')));
    assert.equal(evidence.catalog.spotlightCount,0); assert.equal(evidence.catalog.sourceCount,0);
    assert.equal(evidence.catalog.constraints.filter(c=>c.type==='f').length,8);
    assert.equal(evidence.catalog.indexes.length,11); assert.ok(evidence.catalog.tables.every(t=>t.rls));
  });
  await test('Postflight status clean; command replay applies nothing and keeps one history row', async () => {
    assert.match(await status(),/up to date/i);
    assert.match(await npm('migrate:deploy'),/No pending migrations/i);
    assert.equal(await sql(`SELECT count(*) FROM _prisma_migrations WHERE migration_name='${migrationName}'`),'1');
  });
  await test('Failed synthetic migration rolls back DDL; next guarded apply refuses failed history', async () => {
    write('prisma/migrations/20260910180200_synthetic_failure/migration.sql','BEGIN; CREATE TABLE synthetic_failed_table(id TEXT); SELECT 1/0; COMMIT;');
    await npm('migrate:deploy',{code:1});
    assert.equal(await sql("SELECT to_regclass('public.synthetic_failed_table') IS NULL"),'t');
    const failedBefore=await sql("SELECT count(*) FROM _prisma_migrations WHERE migration_name='20260910180200_synthetic_failure' AND finished_at IS NULL AND rolled_back_at IS NULL");
    assert.equal(failedBefore,'1');
    assert.match(await npm('migrate:deploy',{code:1}),/previous migration failed|failed state/i);
    assert.equal(await sql("SELECT count(*) FROM _prisma_migrations WHERE migration_name='20260910180200_synthetic_failure'"),'1');
  });
  evidence.status='passed';
}
main().catch(error=>{ evidence.status=container?'failed':'blocked'; evidence.error=error.message; process.exitCode=1; console.error(evidence.status.toUpperCase()+': '+error.message); }).finally(async()=>{
  if(container) {
    try { await verify(); await ok(['rm','-f','-v',container]); evidence.disposableContainerRemoved=true; }
    catch(error) { evidence.cleanupError=error.message; evidence.status='failed'; process.exitCode=1; }
  }
  if(scratch && (!container || evidence.disposableContainerRemoved)) {
    assert.ok(path.resolve(scratch).startsWith(path.resolve(os.tmpdir())+path.sep+'folio-spotlight-command-'));
    fs.rmSync(scratch,{recursive:true,force:true});
  }
  evidence.finishedAt=new Date().toISOString();
  fs.writeFileSync(path.join(root,'tasks/spotlight-command-results.json'),JSON.stringify(evidence,null,2)+'\n');
});
