// One additive, hash-pinned migration. No application records or other migrations are changed.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash, randomUUID } = require('node:crypto');
const migration = '20261117170000_private_room_names';
const approvedHash = 'a6abbea1e3df6cff949ff6be6a74bd0639e9154298ae3c38dc3fe1906f044389';
const projectRef = 'gwdkhgejsyvynqzolyau';
const digest = value => createHash('sha256').update(value).digest('hex');

function assertTarget(env) {
  const direct = new URL(env.DIRECT_URL || '');
  const app = new URL(env.DATABASE_URL || '');
  for (const url of [direct, app]) {
    assert(['postgres:', 'postgresql:'].includes(url.protocol), 'PostgreSQL connection required');
    const matchesProject = url.hostname === `db.${projectRef}.supabase.co` ||
      (url.hostname.endsWith('.pooler.supabase.com') && decodeURIComponent(url.username).endsWith(`.${projectRef}`));
    assert(matchesProject, 'Connection must target the approved Folio Supabase project');
    assert(!url.searchParams.has('schema') || url.searchParams.get('schema') === 'public', 'Only public schema is approved');
  }
  assert.equal(direct.pathname, app.pathname, 'Application and migration databases must match');
  assert.equal(direct.port || '5432', '5432', 'Migration requires a direct or session connection');
  assert.notEqual(direct.searchParams.get('pgbouncer'), 'true', 'Transaction pooling is not allowed for migration');
  // Use the application's known-working credentials on the shared session pooler.
  // Port 5432 preserves the migration transaction; never migrate through port 6543.
  if (app.hostname.endsWith('.pooler.supabase.com')) {
    app.port = '5432';
    app.searchParams.delete('pgbouncer');
    return app.toString();
  }
  return direct.toString();
}

async function verifyTable(tx) {
  const columns = await tx.$queryRawUnsafe(`SELECT column_name, data_type, is_nullable, datetime_precision, column_default
    FROM information_schema.columns WHERE table_schema='public' AND table_name='user_room_names' ORDER BY ordinal_position`);
  assert.deepEqual(columns.map(c => [c.column_name, c.data_type, c.is_nullable]), [
    ['userId', 'text', 'NO'], ['normalizedName', 'text', 'NO'], ['name', 'text', 'NO'], ['createdAt', 'timestamp without time zone', 'NO'],
  ], 'Saved-room table must match the reviewed columns');
  assert.equal(columns[3].datetime_precision, 3, 'Timestamp precision must match Prisma');
  assert(['CURRENT_TIMESTAMP', 'now()'].includes(columns[3].column_default), 'Creation timestamp default must be present');
  const constraints = await tx.$queryRawUnsafe(`SELECT contype::text AS type, pg_get_constraintdef(oid) AS definition, convalidated AS valid
    FROM pg_constraint WHERE conrelid='public.user_room_names'::regclass AND contype <> 'n' ORDER BY contype`);
  assert.equal(constraints.length, 2, 'Only the reviewed primary and foreign keys are expected');
  assert(constraints.every(c => c.valid), 'The reviewed constraints must be validated');
  assert(constraints.some(c => c.type === 'p' && c.definition === 'PRIMARY KEY ("userId", "normalizedName")'), 'Composite primary key is required');
  assert(constraints.some(c => c.type === 'f' && /^FOREIGN KEY \("userId"\) REFERENCES (public\.)?users\(id\) ON UPDATE CASCADE ON DELETE CASCADE$/.test(c.definition)), 'Owner foreign key and cascades must match');
  const [security] = await tx.$queryRawUnsafe(`SELECT relrowsecurity AS enabled,
    (SELECT count(*)::int FROM pg_policy WHERE polrelid=c.oid) AS policies
    FROM pg_class c WHERE oid='public.user_room_names'::regclass`);
  assert.equal(security.enabled, true, 'Saved names require row-level security');
  assert.equal(security.policies, 0, 'No public client policy is approved');
}

async function applyMigration(tx, bytes) {
  const sql = bytes.toString('utf8');
  assert.equal(digest(sql.replace(/\r\n/g, '\n')), approvedHash, 'Only the exact reviewed SQL is allowed');
  await tx.$queryRawUnsafe('SELECT pg_advisory_xact_lock(727864)::text AS lock');
  const users = await tx.$queryRawUnsafe(`SELECT data_type FROM information_schema.columns
    WHERE table_schema='public' AND table_name='users' AND column_name='id'`);
  assert.deepEqual(users, [{ data_type: 'text' }], 'Production users.id must be TEXT');
  const failed = await tx.$queryRawUnsafe(`SELECT migration_name FROM public._prisma_migrations
    WHERE finished_at IS NULL AND rolled_back_at IS NULL`);
  assert.equal(failed.length, 0, 'An unresolved failed migration must be investigated first');
  const records = await tx.$queryRawUnsafe(`SELECT checksum FROM public._prisma_migrations
    WHERE migration_name=$1 AND finished_at IS NOT NULL AND rolled_back_at IS NULL`, migration);
  assert(records.length <= 1, 'Duplicate migration bookkeeping is not safe');
  if (records.length) {
    assert.equal(records[0].checksum, digest(bytes), 'Recorded migration checksum must match');
    await verifyTable(tx);
    return 'already applied and verified';
  }
  const [existing] = await tx.$queryRawUnsafe("SELECT to_regclass('public.user_room_names')::text AS name");
  if (existing.name) await verifyTable(tx); // Never repair or overwrite an unexpected existing table.
  // This pinned file has two DDL statements; comment punctuation is not SQL syntax.
  for (const statement of sql.replace(/--[^\r\n]*/g, '').split(';').filter(part => part.trim())) await tx.$executeRawUnsafe(statement);
  await verifyTable(tx);
  await tx.$executeRawUnsafe(`INSERT INTO public._prisma_migrations
    (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
    VALUES ($1, $2, CURRENT_TIMESTAMP, $3, NULL, NULL, CURRENT_TIMESTAMP, 1)`, randomUUID(), digest(bytes), migration);
  return 'applied and recorded atomically';
}

async function main() {
  if (process.env.VERCEL_ENV !== 'production') {
    console.log('[room-names release] Skipped outside Vercel production.');
    return;
  }
  const datasourceUrl = assertTarget(process.env);
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient({ datasourceUrl, log: [] });
  try {
    const bytes = fs.readFileSync(path.join(__dirname, '../prisma/migrations', migration, 'migration.sql'));
    const outcome = await prisma.$transaction(tx => applyMigration(tx, bytes), { maxWait: 10000, timeout: 30000 });
    console.log(`[room-names release] ${migration}: ${outcome}; owner type, keys, RLS and checksum verified.`);
  } finally { await prisma.$disconnect(); }
}

module.exports = { applyMigration, assertTarget, migration, verifyTable };
if (require.main === module) main().catch(error => {
  // Provider errors can contain connection details. Print only our own assertion messages.
  console.error('[room-names release] Failed:', error.code === 'ERR_ASSERTION' ? error.message : (error.code || error.errorCode || error.name || 'database preflight/apply error'));
  process.exitCode = 1;
});
