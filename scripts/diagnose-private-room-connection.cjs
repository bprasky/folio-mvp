const { PrismaClient } = require('@prisma/client');
const fs = require('node:fs');
const { assertTarget, applyMigration, migration } = require('./release-private-room-names.cjs');
const bytes = fs.readFileSync('prisma/migrations/' + migration + '/migration.sql');
function safeError(error) {
  const message = String(error.message || '');
  return { type: /^[A-Za-z0-9_]+$/.test(error.name || '') ? error.name : 'Error',
    code: /^[A-Z0-9_]+$/.test(error.code || '') ? error.code : undefined,
    errorCode: /^[A-Z0-9_]+$/.test(error.errorCode || '') ? error.errorCode : undefined,
    assertion: error.code === 'ERR_ASSERTION' ? message : undefined,
    flags: ['connect','authentication','TLS','prepared statement','engine','Unknown argument','Invalid','unsupported','uuid','timeout','deserialize','permission','FATAL'].filter(term => message.toLowerCase().includes(term.toLowerCase())) };
}
(async () => {
  const direct = assertTarget(process.env);
  const session = new URL(process.env.DATABASE_URL);
  if (!session.hostname.endsWith('.pooler.supabase.com')) throw new Error('Approved shared pooler required');
  session.port = '5432'; session.searchParams.delete('pgbouncer');
  for (const [label, datasourceUrl] of [['configured-direct', direct], ['shared-session', session.toString()]]) {
    const client = new PrismaClient({ datasourceUrl, log: [] }); let stage = 'connect';
    try {
      await client.$connect(); stage = 'select-one';
      await client.$queryRawUnsafe('SELECT 1::int AS ok');
      console.log('[room-diagnostic]', label, 'connection passed');
      stage = 'transaction'; let queries = 0;
      await client.$transaction(tx => applyMigration({
        $queryRawUnsafe: async (...args) => { stage = 'read-query-' + (++queries); return tx.$queryRawUnsafe(...args); },
        $executeRawUnsafe: async () => { stage = 'stopped-before-first-write'; throw new Error('NO_WRITE'); },
      }, bytes), { maxWait:10000,timeout:30000 });
      console.log('[room-diagnostic]', label, 'existing schema verified without writes');
    } catch (error) { console.log('[room-diagnostic]', label, stage, JSON.stringify(safeError(error))); }
    finally { await client.$disconnect(); }
  }
})().catch(error => console.log('[room-diagnostic]', JSON.stringify(safeError(error)))).finally(() => { process.exitCode = 1; });
