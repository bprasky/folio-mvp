/**
 * The guard that stops DDL going through a transaction pooler.
 *
 * Every migration and introspection script reaches for
 * `DIRECT_URL || DATABASE_URL`. That fallback was harmless while both pointed at
 * the same kind of connection. Moving DATABASE_URL to Supavisor's transaction
 * pooler made it dangerous: transaction pooling hands each statement to a
 * different backend, so `prisma migrate`'s advisory lock is not held and
 * multi-statement DDL can half-apply — reporting success while leaving the
 * schema in a state nobody wrote down. That is the shape of drift Phases 1-5D
 * spent weeks unwinding.
 *
 * Each case runs in a real subprocess, because the guard's whole contract is
 * which exit code it produces under which environment. Asserting on the source
 * would prove nothing about that.
 *
 * Run: npm run check:migration-connection
 */
import { spawnSync } from 'child_process';

let failures = 0;
const check = (name: string, cond: boolean, detail?: string) => {
  if (cond) console.log(`  PASS  ${name}`);
  else { failures++; console.error(`  FAIL  ${name}${detail ? `\n        ${detail}` : ''}`); }
};

const DIRECT  = 'postgresql://postgres:pw@db.abc.supabase.co:5432/postgres';
const SESSION = 'postgresql://postgres.abc:pw@aws-0-us-east-1.pooler.supabase.com:5432/postgres';
const TXN     = 'postgresql://postgres.abc:pw@aws-0-us-east-1.pooler.supabase.com:6543/postgres';

/**
 * Run the guard in a clean process and report what it did.
 *
 * spawnSync, not execFileSync: the guard WARNS on the paths where it succeeds,
 * and execFileSync returns only stdout, so a warning on a zero-exit run would be
 * invisible here. Every case needs both streams and the code.
 */
function run(env: Record<string, string | undefined>, readOnly = false) {
  const script =
    `import { migrationConnectionUrl } from './scripts/lib/migrationConnection.mjs';` +
    `const u = migrationConnectionUrl({ label: 'test', readOnly: ${readOnly} });` +
    `console.log('RESOLVED:' + u);`;
  const r = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
    env: { PATH: process.env.PATH, ...env } as NodeJS.ProcessEnv,
    encoding: 'utf8',
  });
  const stdout = String(r.stdout ?? '');
  return {
    exitCode: r.status ?? 1,
    resolved: (stdout.match(/RESOLVED:(.*)/) ?? [])[1] ?? null,
    stderr: String(r.stderr ?? ''),
  };
}

console.log('\n1. DIRECT_URL is used whenever it is set');
check('a direct URL is returned as-is',
  run({ DIRECT_URL: DIRECT, DATABASE_URL: TXN }).resolved === DIRECT);
check('...and it wins even when DATABASE_URL is transaction-pooled',
  run({ DIRECT_URL: DIRECT, DATABASE_URL: TXN }).exitCode === 0);

console.log('\n2. A writing script will NOT run DDL through a transaction pooler');
// This is the case the guard exists for.
const refused = run({ DATABASE_URL: TXN });
check('no DIRECT_URL + transaction-pooled DATABASE_URL exits non-zero',
  refused.exitCode !== 0);
check('...and says what to set, not just that it failed',
  /Set DIRECT_URL to the direct connection/.test(refused.stderr ?? ''));
check('...and explains the actual failure mode',
  /advisory locks are not held/.test(refused.stderr ?? '')
  && /half-apply/.test(refused.stderr ?? ''));
// pgbouncer=true means prepared statements are off, which is the same hazard
// arriving on a different port.
check('pgbouncer=true is treated as transaction-pooled regardless of port',
  run({ DATABASE_URL: `${SESSION}?pgbouncer=true` }).exitCode !== 0);

console.log('\n3. The fallback still works where it is safe');
// Session mode pins a connection for the session, so advisory locks hold.
check('a session-mode DATABASE_URL is allowed through',
  run({ DATABASE_URL: SESSION }).resolved === SESSION);
check('...with a warning, so the fallback is never silent',
  /DIRECT_URL is not set/.test(run({ DATABASE_URL: SESSION }).stderr ?? ''));
check('a direct DATABASE_URL is allowed through too',
  run({ DATABASE_URL: DIRECT }).resolved === DIRECT);

console.log('\n4. Read-only scripts are not blocked by a hazard they cannot hit');
// A SELECT is self-contained; it does not matter which backend serves it. The
// recon step of the migration runbook is entirely read-only.
const ro = run({ DATABASE_URL: TXN }, true);
check('a read-only script may read through the transaction pooler',
  ro.exitCode === 0 && ro.resolved === TXN);
check('...and is still told it is doing so',
  /transaction/.test(ro.stderr ?? '') && /DIRECT_URL is not set/.test(ro.stderr ?? ''),
  `stderr was: ${JSON.stringify(ro.stderr ?? '')}`);
check('the four recon scripts declare themselves read-only', (() => {
  const { readFileSync } = require('fs');
  return ['migration-audit-probe', 'introspect-targeted', 'schema-parity-audit', 'introspect-tables']
    .every((f) => /readOnly: true/.test(readFileSync(`scripts/${f}.mjs`, 'utf8')));
})());
// The one script that writes DDL must NOT be marked read-only.
check('apply-migration-file is NOT marked read-only', (() => {
  const { readFileSync } = require('fs');
  const s = readFileSync('scripts/apply-migration-file.mjs', 'utf8');
  return /migrationConnectionUrl\(/.test(s) && !/readOnly: true/.test(s);
})());

console.log('\n5. Nothing bypasses the guard');
check('no script still resolves the URL inline', (() => {
  const { execSync } = require('child_process');
  const hits = execSync(
    "grep -rl 'process.env.DIRECT_URL || process.env.DATABASE_URL' scripts/ "
    + "--exclude=check-migration-connection.ts || true",
    { encoding: 'utf8' }).split('\n').filter(Boolean);
  return hits.length === 0;
})());
check('a missing database is still a clear error',
  /neither DIRECT_URL nor DATABASE_URL/.test(run({}).stderr ?? ''));

console.log(failures === 0
  ? '\nAll migration-connection checks passed.\n'
  : `\n${failures} check(s) failed.\n`);
process.exit(failures === 0 ? 0 : 1);
