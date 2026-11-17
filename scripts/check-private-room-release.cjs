const assert = require('node:assert/strict');
const fs = require('node:fs');
const { PGlite } = require('@electric-sql/pglite');
const { applyMigration, assertTarget, migration } = require('./release-private-room-names.cjs');
const sql = fs.readFileSync(`prisma/migrations/${migration}/migration.sql`);
const env = { DIRECT_URL: 'postgresql://postgres:synthetic@db.gwdkhgejsyvynqzolyau.supabase.co:5432/postgres', DATABASE_URL: 'postgresql://postgres.gwdkhgejsyvynqzolyau:synthetic@aws-0-us-east-1.pooler.supabase.com:6543/postgres' };
assertTarget(env);
for (const changed of [
  { DIRECT_URL: env.DIRECT_URL.replace(':5432', ':6543') },
  { DIRECT_URL: env.DIRECT_URL + '?pgbouncer=true' },
  { DIRECT_URL: env.DIRECT_URL.replace('gwdkhgejsyvynqzolyau', 'other') },
  { DATABASE_URL: env.DATABASE_URL.replace(/\/postgres$/, '/other') },
  { DATABASE_URL: env.DATABASE_URL + '?schema=other' },
]) assert.throws(() => assertTarget({ ...env, ...changed }));

const adapter = pg => ({
  $queryRawUnsafe: async (query, ...params) => (await pg.query(query, params)).rows,
  $executeRawUnsafe: async (query, ...params) => pg.query(query, params),
});
async function main() {
  const pg = new PGlite();
  const apply = bytes => pg.transaction(tx => applyMigration(adapter(tx), bytes || sql));
  try {
    await pg.exec(`CREATE TABLE users(id TEXT PRIMARY KEY);
      CREATE TABLE _prisma_migrations(id TEXT PRIMARY KEY, checksum TEXT NOT NULL, finished_at TIMESTAMPTZ,
      migration_name TEXT NOT NULL, logs TEXT, rolled_back_at TIMESTAMPTZ, started_at TIMESTAMPTZ NOT NULL, applied_steps_count INTEGER NOT NULL DEFAULT 0);`);
    await assert.rejects(apply(Buffer.from(sql + '\nSELECT 1;')), /exact reviewed SQL/);
    assert.equal(await apply(), 'applied and recorded atomically');
    assert.equal(await apply(), 'already applied and verified');
    assert.equal((await pg.query('SELECT * FROM _prisma_migrations')).rows.length, 1);
    await pg.exec(`INSERT INTO users VALUES ('a'); INSERT INTO user_room_names ("userId","normalizedName",name) VALUES ('a','flower studio','Flower Studio');`);
    assert.equal(await apply(), 'already applied and verified');
    assert.equal((await pg.query('SELECT name FROM user_room_names')).rows[0].name, 'Flower Studio');
    await pg.exec('CREATE POLICY unexpected ON user_room_names FOR SELECT USING (true)');
    await assert.rejects(apply(), /No public client policy/);
    await pg.exec('DROP POLICY unexpected ON user_room_names; ALTER TABLE user_room_names DISABLE ROW LEVEL SECURITY');
    await assert.rejects(apply(), /row-level security/);
    await pg.exec('ALTER TABLE user_room_names ENABLE ROW LEVEL SECURITY; ALTER TABLE user_room_names ADD COLUMN unexpected TEXT');
    await assert.rejects(apply(), /reviewed columns/);
    await pg.exec('ALTER TABLE user_room_names DROP COLUMN unexpected;');
    await pg.query("UPDATE _prisma_migrations SET checksum='tampered'");
    await assert.rejects(apply(), /checksum/);
    await pg.exec('DELETE FROM _prisma_migrations;');
    assert.equal(await apply(), 'applied and recorded atomically');
    await pg.query(`INSERT INTO _prisma_migrations(id,checksum,migration_name,started_at) VALUES ('failed','x','unrelated',CURRENT_TIMESTAMP)`);
    await assert.rejects(apply(), /unresolved failed migration/);
    await pg.exec("DELETE FROM _prisma_migrations WHERE id='failed'; DELETE FROM _prisma_migrations; DROP TABLE user_room_names;");
    // A failure after DDL must roll back the table and bookkeeping together.
    await assert.rejects(pg.transaction(async tx => { await applyMigration(adapter(tx), sql); throw new Error('simulated failure'); }), /simulated failure/);
    assert.equal((await pg.query("SELECT to_regclass('user_room_names')::text AS name")).rows[0].name, null);
    assert.equal((await pg.query('SELECT * FROM _prisma_migrations')).rows.length, 0);
    await pg.exec('DELETE FROM users; ALTER TABLE users ALTER COLUMN id TYPE UUID USING NULL');
    await assert.rejects(apply(), /users.id must be TEXT/);
    console.log('PASS production target binding, exact SQL, atomic apply/replay/bookkeeping, saved-data preservation, schema/RLS/policy/checksum drift and failure rollback');
  } finally { await pg.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
