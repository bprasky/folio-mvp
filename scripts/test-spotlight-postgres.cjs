// Real PostgreSQL acceptance. Requires a running LOCAL Docker engine and postgres:17.
// No URL/target arguments, host ports, host mounts, env files, or app DB clients.
// All SQL travels through docker exec to a Unix socket in a network-disabled container.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const migrationPath = 'prisma/migrations/20260910180000_add_product_spotlight_draft_selection/migration.sql';
const migration = fs.readFileSync(path.join(root, migrationPath), 'utf8').replace(/\r\n/g, '\n');
const fixtures = fs.readFileSync(path.join(__dirname, 'spotlight-postgres/fixtures.sql'), 'utf8');
const catalogSql = fs.readFileSync(path.join(__dirname, 'spotlight-postgres/catalog.sql'), 'utf8');
const approvedHash = '77fa2afe19f2f1e61d344f54d78381ca18d862b795e48edca9b3101c939291ab';
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
const row = (id, overrides = {}) => {
  const fields = { id, project_id: 'project', product_id: 'product', room_id: 'room', publisher_user_id: 'publisher', selected_by_id: 'selector', updated_at: '2026-09-10 00:00:00', ...overrides };
  const values = Object.values(fields).map(v => v === null ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`);
  return `INSERT INTO public.product_spotlights (${Object.keys(fields).join(',')}) VALUES (${values.join(',')});`;
};
async function test(label, fn) {
  await fn();
  evidence.tests.push({ label, result: 'passed' });
  console.log(`PASS ${label}`);
}
const check = (predicate, label = 'assertion') => `DO $check$ BEGIN IF NOT (${predicate}) THEN RAISE EXCEPTION '${label}'; END IF; END $check$;`;
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
    const r = await cli(['exec', container, 'pg_isready', '-h', '/var/run/postgresql', '-U', 'postgres', '-d', 'spotlight_test']);
    if (r.code === 0) { ready = true; break; }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  assert.ok(ready, 'PostgreSQL startup timed out');
  await sql(fixtures);
  await test('Exact migration executes; new tables initially empty; catalog matches', async () => {
    await sql(migration);
    const cat = JSON.parse(await sql(catalogSql));
    evidence.catalog = cat;
    assert.equal(cat.tables.length, 2);
    assert.ok(cat.tables.every(t => t.rls && !t.force_rls));
    assert.equal(cat.columns.length, 18);
    const types = { id: 'text', project_id: 'text', product_id: 'text', room_id: 'text', publisher_user_id: 'text', publisher_org_id: 'text', variant: 'character varying', finish: 'character varying', is_selected: 'boolean', private_note: 'text', selected_by_id: 'text', selected_at: 'timestamp without time zone', selection_version: 'integer', created_at: 'timestamp without time zone', updated_at: 'timestamp without time zone', tag_id: 'text', spotlight_id: 'text', linked_at: 'timestamp without time zone' };
    for (const column of cat.columns) {
      assert.equal(column.data_type, types[column.column_name]);
      assert.equal(column.is_nullable, ['room_id','publisher_user_id','publisher_org_id','private_note'].includes(column.column_name) ? 'YES' : 'NO');
      if (['variant','finish'].includes(column.column_name)) assert.equal(column.character_maximum_length, 160);
      if (column.data_type.startsWith('timestamp')) assert.equal(column.datetime_precision, 3);
    }
    assert.equal(cat.constraints.filter(x => x.type === 'f').length, 8);
    assert.equal(cat.constraints.filter(x => x.type === 'c').length, 4);
    assert.equal(cat.constraints.filter(x => x.type === 'p').length, 2);
    assert.equal(cat.indexes.length, 11); // Nine secondary indexes plus two PK indexes.
    const references = { project_id: 'projects', product_id: 'products', room_id: 'rooms', publisher_user_id: 'users', publisher_org_id: 'organizations', selected_by_id: 'users', tag_id: 'product_tags', spotlight_id: 'product_spotlights' };
    for (const [column, action] of Object.entries({ project_id: 'c', product_id: 'r', room_id: 'n', publisher_user_id: 'r', publisher_org_id: 'r', selected_by_id: 'r', tag_id: 'c', spotlight_id: 'c' })) {
      const fk = cat.constraints.find(x => x.type === 'f' && x.definition.startsWith(`FOREIGN KEY (${column})`));
      assert.ok(fk, column); assert.equal(fk.delete_action, action); assert.equal(fk.update_action, 'c');
      assert.ok(fk.definition.includes(`REFERENCES ${references[column]}(id)`));
    }
    for (const [scope, publisher] of [['person', 'publisher_user_id'], ['org', 'publisher_org_id']]) {
      const index = cat.indexes.find(x => x.indexname === `product_spotlights_${scope}_scope_key`).indexdef;
      assert.ok(index.includes(`(${publisher}, project_id, product_id, room_id, variant, finish)`));
      assert.ok(index.includes('UNIQUE') && index.includes(`${publisher} IS NOT NULL`) && index.includes('room_id IS NOT NULL'));
    }
    for (const name of ['publisher_xor', 'version_positive', 'variant_trimmed', 'finish_trimmed'])
      assert.ok(cat.constraints.some(x => x.name === `product_spotlights_${name}`));
    assert.equal(cat.policies, 0); assert.equal(cat.spotlightCount, 0); assert.equal(cat.sourceCount, 0);
  });
  await test('Exact SQL replay leaves catalog unchanged', async () => {
    await sql(migration); assert.deepEqual(JSON.parse(await sql(catalogSql)), evidence.catalog);
  });
  await test('Publishing identity XOR rejects zero/two and accepts personal/studio', async () => {
    await sql(row('none', { publisher_user_id: null }), { error: '23514' });
    await sql(row('both', { publisher_org_id: 'studio' }), { error: '23514' });
    await sql('BEGIN;' + row('personal') + row('studio', { publisher_user_id: null, publisher_org_id: 'studio' }) + 'ROLLBACK;');
  });
  await test('Positive version, trimmed bounded variant/finish and FK existence', async () => {
    for (const overrides of [{ selection_version: 0 }, { variant: ' padded' }, { finish: 'padded ' }])
      await sql(row('bad', overrides), { error: '23514' });
    await sql(row('long', { variant: 'x'.repeat(161) }), { error: '22001' });
    for (const field of ['project_id','product_id','room_id','publisher_user_id','selected_by_id'])
      await sql(row('missing', { [field]: 'missing' }), { error: '23503' });
  });
  for (const studio of [false, true]) {
    const identity = studio ? { publisher_user_id: null, publisher_org_id: 'studio' } : {};
    await test(`Confirmed-room uniqueness (${studio ? 'studio' : 'personal'}), including deselected rows`, async () => {
      await sql('BEGIN;' + row('a', identity) + row('b', { ...identity, is_selected: false }) + 'COMMIT;', { error: '23505' });
      await sql('BEGIN;' + row('a', identity) + row('b', { ...identity, variant: 'different' }) + row('c', { ...identity, finish: 'different' }) + 'ROLLBACK;');
    });
  }
  await test('Multiple photo tags share one row; a tag cannot link twice', async () => {
    await sql('BEGIN;' + row('shared') + "INSERT INTO product_spotlight_tags(tag_id,spotlight_id) VALUES ('tag-a','shared'),('tag-b','shared');" + check('(SELECT count(*)=2 FROM product_spotlight_tags)') + 'ROLLBACK;');
    await sql('BEGIN;' + row('shared') + "INSERT INTO product_spotlight_tags(tag_id,spotlight_id) VALUES ('tag-a','shared'),('tag-a','shared'); COMMIT;", { error: '23505' });
  });
  await test('Unresolved rows coexist; failed room reconciliation rolls back both assignments', async () => {
    await sql(row('unresolved-a', { room_id: null }) + row('unresolved-b', { room_id: null }) + "INSERT INTO product_spotlight_tags(tag_id,spotlight_id) VALUES ('tag-a','unresolved-a'),('tag-b','unresolved-b');");
    await sql("BEGIN; UPDATE product_spotlights SET room_id='room' WHERE id='unresolved-a'; UPDATE product_spotlights SET room_id='room' WHERE id='unresolved-b'; COMMIT;", { error: '23505' });
    assert.equal(await sql('SELECT count(*) FROM product_spotlights WHERE room_id IS NULL'), '2');
    assert.equal(await sql('SELECT count(*) FROM product_spotlight_tags'), '2');
  });
  await test('Transactional reconciliation SQL moves sources and keeps one canonical row', async () => {
    await sql("BEGIN; SELECT id FROM product_spotlights WHERE id IN ('unresolved-a','unresolved-b') ORDER BY id FOR UPDATE; UPDATE product_spotlight_tags SET spotlight_id='unresolved-a' WHERE spotlight_id='unresolved-b'; DELETE FROM product_spotlights WHERE id='unresolved-b'; UPDATE product_spotlights SET room_id='room',selection_version=selection_version+1 WHERE id='unresolved-a'; COMMIT;");
    assert.equal(await sql('SELECT count(*) FROM product_spotlights'), '1');
    assert.equal(await sql('SELECT count(*) FROM product_spotlight_tags'), '2');
    assert.equal(await sql('SELECT selection_version FROM product_spotlights'), '2');
  });
  await test('Tag deletion removes one source; last-source deletion retains selected draft', async () => {
    await sql("BEGIN; DELETE FROM product_tags WHERE id='tag-a';" + check('(SELECT count(*)=1 FROM product_spotlight_tags)') + check('(SELECT bool_and(is_selected) FROM product_spotlights)') + "DELETE FROM product_tags WHERE id='tag-b';" + check('(SELECT count(*)=0 FROM product_spotlight_tags)') + check('(SELECT count(*)=1 AND bool_and(is_selected) FROM product_spotlights)') + 'ROLLBACK;');
  });
  await test('Room SET NULL preserves drafts/sources; database does not increment version', async () => {
    await sql("BEGIN; DELETE FROM rooms WHERE id='room';" + check('(SELECT room_id IS NULL AND selection_version=2 FROM product_spotlights)') + check('(SELECT count(*)=2 FROM product_spotlight_tags)') + 'ROLLBACK;');
  });
  await test('Project deletion cascades drafts, sources, rooms, images and tags', async () => {
    await sql("BEGIN; DELETE FROM projects WHERE id='project';" + check('(SELECT count(*)=0 FROM product_spotlights)') + check('(SELECT count(*)=0 FROM product_spotlight_tags)') + check("NOT EXISTS(SELECT 1 FROM product_tags WHERE id IN ('tag-a','tag-b'))") + check("NOT EXISTS(SELECT 1 FROM rooms WHERE id='room')") + check("NOT EXISTS(SELECT 1 FROM project_images WHERE id IN ('photo-a','photo-b'))") + 'ROLLBACK;');
  });
  for (const [label, statement, constraint] of [
    ['product', "DELETE FROM products WHERE id='product'", 'product_spotlights_product_id_fkey'],
    ['publisher', "DELETE FROM users WHERE id='publisher'", 'product_spotlights_publisher_user_id_fkey'],
    ['selector', "DELETE FROM users WHERE id='selector'", 'product_spotlights_selected_by_id_fkey'],
  ]) await test(`${label} deletion restricted by the spotlight FK`, async () => {
    // Remove old tag/product dependencies so the new FK is the observed blocker.
    await sql("BEGIN; DELETE FROM product_tags WHERE id IN ('tag-a','tag-b');" + statement + ';COMMIT;', { error: `23503[\\s\\S]*${constraint}` });
  });
  await test('Studio publisher deletion restricted', async () => {
    await sql('BEGIN;' + row('studio-delete', { publisher_user_id: null, publisher_org_id: 'studio' }) + "DELETE FROM organizations WHERE id='studio';COMMIT;", { error: '23503[\\s\\S]*product_spotlights_publisher_org_id_fkey' });
  });
  await test('Direct spotlight deletion cascades sources but keeps photo tags', async () => {
    await sql('BEGIN; DELETE FROM product_spotlights;' + check('(SELECT count(*)=0 FROM product_spotlight_tags)') + check("(SELECT count(*)=2 FROM product_tags WHERE id IN ('tag-a','tag-b'))") + 'ROLLBACK;');
  });
  await test('Browser RLS denies reads/writes even with table grants; privileged server works', async () => {
    await sql('CREATE ROLE anon NOLOGIN NOSUPERUSER NOBYPASSRLS; CREATE ROLE authenticated NOLOGIN NOSUPERUSER NOBYPASSRLS; CREATE ROLE service_role NOLOGIN NOSUPERUSER BYPASSRLS; GRANT USAGE ON SCHEMA public TO anon,authenticated,service_role; GRANT SELECT,INSERT,UPDATE,DELETE ON product_spotlights,product_spotlight_tags TO anon,authenticated,service_role;');
    for (const role of ['anon','authenticated']) {
      for (const table of ['product_spotlights','product_spotlight_tags']) {
        assert.equal(await sql(`SET ROLE ${role}; SELECT count(*) FROM ${table};`), '0');
        assert.equal(await sql(`SET ROLE ${role}; WITH changed AS (DELETE FROM ${table} RETURNING *) SELECT count(*) FROM changed;`), '0');
        const assignment = table === 'product_spotlights' ? 'is_selected=false' : "spotlight_id='unresolved-a'";
        assert.equal(await sql(`SET ROLE ${role}; WITH changed AS (UPDATE ${table} SET ${assignment} RETURNING *) SELECT count(*) FROM changed;`), '0');
      }
      await sql(`SET ROLE ${role};` + row('browser', { room_id: null }), { error: '42501' });
      await sql(`SET ROLE ${role}; INSERT INTO product_spotlight_tags(tag_id,spotlight_id) VALUES ('other-tag','unresolved-a');`, { error: '42501' });
    }
    await sql('BEGIN; SET LOCAL ROLE service_role;' + row('server', { room_id: null }) + "INSERT INTO product_spotlight_tags(tag_id,spotlight_id) VALUES ('other-tag','server');" + check('(SELECT count(*)=2 FROM product_spotlights)') + 'ROLLBACK;');
  });
  await test('Cross-project/source consistency is NOT database-enforced (service responsibility)', async () => {
    await sql('BEGIN;' + row('cross-project', { room_id: 'other-room', publisher_user_id: 'other-publisher' }) + "INSERT INTO product_spotlight_tags(tag_id,spotlight_id) VALUES ('other-tag','cross-project'); ROLLBACK;");
  });
  for (const studio of [false,true]) await test(`Concurrent ${studio ? 'studio' : 'personal'} duplicate inserts: one commit, one unique violation`, async () => {
    const identity = studio ? { publisher_user_id: null, publisher_org_id: 'studio' } : {};
    const app = studio ? 'spotlight-race-studio' : 'spotlight-race-person';
    const winner = sql('BEGIN;' + row(app + '-a', { ...identity, variant: app }) + 'SELECT pg_sleep(4);COMMIT;', { app });
    // Catch promptly even if readiness fails, avoiding an unhandled rejection.
    const winnerResult = winner.then(() => null, e => e);
    let locked = false;
    for (let i = 0; i < 30; i++) {
      if (await sql(`SELECT count(*) FROM pg_stat_activity WHERE application_name='${app}' AND wait_event='PgSleep'`) === '1') { locked = true; break; }
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    assert.ok(locked, 'Winner must hold its uncommitted unique key before the competitor starts');
    await sql(row(app + '-b', { ...identity, variant: app }), { error: '23505' });
    const failure = await winnerResult; if (failure) throw failure;
    assert.equal(await sql(`SELECT count(*) FROM product_spotlights WHERE variant='${app}'`), '1');
  });
  await test('Replay with stored rows preserves data and links', async () => {
    const before = await sql(catalogSql); await sql(migration); assert.equal(await sql(catalogSql), before);
  });
  await test('Failed DDL transaction leaves no spotlight tables; exact retry/replay succeeds', async () => {
    await sql('CREATE DATABASE spotlight_rollback;');
    await sql(fixtures, { database: 'spotlight_rollback' });
    // Only this fault-injection copy changes SQL; the approved file stays byte-identical.
    await sql(migration.replace('COMMIT;', 'SELECT 1/0;\nCOMMIT;'), { database: 'spotlight_rollback', error: '22012' });
    assert.equal(await sql("SELECT count(*) FROM pg_tables WHERE schemaname='public' AND tablename IN ('product_spotlights','product_spotlight_tags')", { database: 'spotlight_rollback' }), '0');
    await sql(migration, { database: 'spotlight_rollback' });
    await sql(migration, { database: 'spotlight_rollback' });
    const cat = JSON.parse(await sql(catalogSql, { database: 'spotlight_rollback' }));
    assert.equal(cat.spotlightCount, 0); assert.equal(cat.sourceCount, 0);
  });
  evidence.status = 'passed';
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
  fs.writeFileSync(path.join(root, 'tasks/spotlight-postgres-results.json'), JSON.stringify(evidence, null, 2) + '\n');
});
