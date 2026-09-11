// Real PostgreSQL acceptance. Requires a running LOCAL Docker engine and postgres:17.
// No URL/target arguments, host ports, host mounts, env files, or app DB clients.
// All SQL travels through docker exec to a Unix socket in a network-disabled container.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const migrationPath = 'prisma/migrations/20260910210000_add_spotlight_durable_interview/migration.sql';
const migration = fs.readFileSync(path.join(root, migrationPath), 'utf8').replace(/\r\n/g, '\n');
const fixtures = fs.readFileSync(path.join(__dirname, 'spotlight-postgres/fixtures.sql'), 'utf8');
const catalogSql = fs.readFileSync(path.join(__dirname, 'spotlight-durable-postgres/catalog.sql'), 'utf8');
const approvedHash = '50adeaf12a7b402181769746caed685ba3c0a5b58821528f83cffa397e5e2c10';
const nonce = crypto.randomBytes(16).toString('hex');
const name = `folio-spotlight-test-${nonce}`;
const docker = process.platform === 'win32' ? 'C:/Program Files/Docker/Docker/resources/bin/docker.exe' : 'docker';
// Deliberately omit DATABASE_URL, DIRECT_URL, PG*, DOCKER_HOST/CONTEXT, NODE_OPTIONS,
// and all application secrets. The chosen context must resolve to a local socket.
const env = Object.fromEntries(Object.entries(process.env).filter(([k]) =>
  /^(PATH|PATHEXT|SYSTEMROOT|WINDIR|TEMP|TMP|HOME|USERPROFILE|APPDATA|LOCALAPPDATA|PROGRAMDATA)$/i.test(k)));
let container;
let context;
const evidence = { migrationPath, approvedHash, startedAt: new Date().toISOString(), status: 'running', tests: [], applicationDatabaseContacted: false };
function run(exe, args, input = '', timeout = 30000) {
  return new Promise((resolve, reject) => {
    const child = spawn(exe, args, { cwd: root, env, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    const timer = setTimeout(() => child.kill(), timeout);
    child.on('error', error => { clearTimeout(timer); reject(error); });
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.stdin.on('error', () => {});
    child.on('close', (code, signal) => { clearTimeout(timer); resolve({ code, signal, stdout, stderr }); });
    child.stdin.end(input);
  });
}
const cli = (args, input, timeout) => run(docker, context ? ['--context', context, ...args] : args, input, timeout);
async function ok(args, input, timeout) {
  const r = await cli(args, input, timeout);
  assert.equal(r.code, 0, `Docker command failed: ${r.stderr.slice(0, 1000)}`);
  return r.stdout.trim();
}
async function verifyContainer() {
  assert.match(container, /^[a-f0-9]{64}$/);
  const [c] = JSON.parse(await ok(['inspect', container]));
  assert.equal(c.Id, container);
  assert.equal(c.Name, '/' + name);
  assert.equal(c.Config.Labels['folio.spotlight.test'], nonce);
  assert.equal(c.HostConfig.NetworkMode, 'none');
  assert.equal(c.HostConfig.Privileged, false);
  assert.equal(Object.keys(c.HostConfig.PortBindings || {}).length, 0);
  assert.equal((c.HostConfig.Binds || []).length, 0);
  assert.equal(c.Mounts.every(m => m.Type === 'tmpfs'), true);
  assert.equal(c.Config.Image, 'postgres:17');
  return c;
}
async function sql(text, { database = 'spotlight_test', error, app = 'spotlight-test' } = {}) {
  assert.ok(['spotlight_test', 'spotlight_rollback'].includes(database));
  await verifyContainer();
  const r = await cli(['exec', '-i', '-e', 'PGHOST=/var/run/postgresql', '-e', 'PGPORT=5432',
    '-e', `PGAPPNAME=${app}`, container, 'psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1',
    '-v', 'VERBOSITY=verbose', '-U', 'postgres', '-d', database], text);
  if (error) {
    assert.notEqual(r.code, 0, 'Expected database rejection');
    assert.match(r.stderr, new RegExp(error), 'Expected SQLSTATE/constraint');
  } else assert.equal(r.code, 0, r.stderr);
  return r.stdout.trim();
}
async function test(label, fn) { await fn(); evidence.tests.push({label,result:'passed'}); console.log('PASS '+label); }
async function main() {
  assert.equal(process.argv.length, 2, 'No target or URL arguments accepted');
  assert.equal(crypto.createHash('sha256').update(migration).digest('hex'), approvedHash);
  context = await ok(['context', 'show']);
  const [ctx] = JSON.parse(await ok(['context', 'inspect', context]));
  assert.match(ctx.Endpoints.docker.Host, /^(npipe:\/\/|unix:\/\/)/, 'Remote Docker contexts are prohibited');
  await ok(['info', '--format', '{{.ServerVersion}}']);
  // Pull only this public local-development image if absent; no paid provisioning.
  const cached = await cli(['image', 'inspect', 'postgres:17']);
  if (cached.code !== 0) await ok(['pull', 'postgres:17'], '', 300000);
  container = await ok(['run', '-d', '--name', name, '--label', `folio.spotlight.test=${nonce}`,
    '--network', 'none', '--tmpfs', '/var/lib/postgresql/data:rw',
    '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', '-e', 'POSTGRES_DB=spotlight_test',
    'postgres:17', '-c', 'listen_addresses=']);
  const c = await verifyContainer();
  evidence.isolation = { localDockerSocket: true, network: 'none', ports: 0, hostMounts: 0, storage: 'tmpfs', imageId: c.Image, tcpListener: false };
  let ready = false;
  for (let n = 0; n < 60; n++) {
    // The image starts a temporary server during initdb, then stops it. Wait
    // for the entrypoint's final exec, not just that temporary server's socket.
    const pidOne = await cli(['exec', container, 'cat', '/proc/1/comm']);
    const r = await cli(['exec', container, 'pg_isready', '-h', '/var/run/postgresql', '-U', 'postgres', '-d', 'spotlight_test']);
    if (pidOne.stdout.trim() === 'postgres' && r.code === 0) { ready = true; break; }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  assert.ok(ready, 'PostgreSQL startup timed out');
  await sql(fixtures);
  await sql(fs.readFileSync(path.join(root,'prisma/migrations/20260910180000_add_product_spotlight_draft_selection/migration.sql'),'utf8'));
  await require('./spotlight-durable-postgres/suite.cjs')({sql,test,migration,catalogSql,evidence});
  evidence.status='passed';
}
main().catch(error => {
  evidence.status = container ? 'failed' : 'blocked';
  evidence.error = error.message;
  console.error(`${evidence.status.toUpperCase()}: ${error.message}`);
  process.exitCode = 1;
}).finally(async () => {
  if (container) {
    try { await verifyContainer(); await ok(['rm', '-f', '-v', container]); evidence.disposableContainerRemoved = true; }
    catch (error) { evidence.cleanupError = error.message; evidence.status = 'failed'; process.exitCode = 1; }
  }
  evidence.finishedAt = new Date().toISOString();
  fs.writeFileSync(path.join(root, 'tasks/spotlight-durable-postgres-results.json'), JSON.stringify(evidence, null, 2) + '\n');
});
