/**
 * The connection-pool settings that decide whether a deploy takes the site down.
 *
 * Supavisor's session-mode pool is 15. Prisma's default connection_limit is
 * `num_cpus * 2 + 1`, so three to five warm lambda instances reach it — and a
 * deploy briefly runs two fleets at once, which is why the site 500s after a
 * push and recovers on its own once the old instances idle out.
 *
 * This exercises the URL tuning for real rather than asserting it exists,
 * because every case here is a way to get it subtly wrong: clobbering somebody's
 * explicit setting, dropping credentials, losing an unrelated query parameter,
 * or turning a malformed URL into a silent mystery instead of a startup error.
 *
 * Run: npm run check:db-pool
 */
import { readFileSync } from 'fs';
import { execSync } from 'child_process';
import { tunePoolForServerless } from '../src/lib/prisma';

let failures = 0;
const check = (name: string, cond: boolean, detail?: string) => {
  if (cond) console.log(`  PASS  ${name}`);
  else { failures++; console.error(`  FAIL  ${name}${detail ? `\n        ${detail}` : ''}`); }
};
const q = (url: string | undefined, key: string) =>
  url ? new URL(url).searchParams.get(key) : null;

const SESSION = 'postgresql://postgres.abc:pw@aws-0-us-east-1.pooler.supabase.com:5432/postgres';
const TXN     = 'postgresql://postgres.abc:pw@aws-0-us-east-1.pooler.supabase.com:6543/postgres';

console.log('\n1. An untuned URL gets capped');
check('a session-mode URL is given connection_limit=1',
  q(tunePoolForServerless(SESSION), 'connection_limit') === '1');
check('a transaction-mode URL is too',
  q(tunePoolForServerless(TXN), 'connection_limit') === '1');

console.log('\n2. Transaction mode needs prepared statements off');
// Port 6543 hands each statement to a different backend, so a prepared
// statement from the last one is gone. Symptom is not a pool error but random
// "prepared statement s0 already exists".
check('port 6543 gets pgbouncer=true',
  q(tunePoolForServerless(TXN), 'pgbouncer') === 'true');
check('port 5432 does NOT — session mode keeps its backend, and the flag costs speed',
  q(tunePoolForServerless(SESSION), 'pgbouncer') === null);

console.log('\n3. An explicit setting is a decision, not a default to overwrite');
check('an explicit connection_limit is left alone',
  q(tunePoolForServerless(`${SESSION}?connection_limit=5`), 'connection_limit') === '5');
check('an explicit pgbouncer=false is left alone',
  q(tunePoolForServerless(`${TXN}?pgbouncer=false`), 'pgbouncer') === 'false');
check('PRISMA_CONNECTION_LIMIT overrides the default', (() => {
  process.env.PRISMA_CONNECTION_LIMIT = '3';
  const got = q(tunePoolForServerless(SESSION), 'connection_limit');
  delete process.env.PRISMA_CONNECTION_LIMIT;
  return got === '3';
})());

console.log('\n4. Nothing else about the URL changes');
const tuned = tunePoolForServerless(`${SESSION}?sslmode=require&schema=public`)!;
check('unrelated query parameters survive',
  q(tuned, 'sslmode') === 'require' && q(tuned, 'schema') === 'public');
check('credentials, host, port and database survive', (() => {
  const u = new URL(tuned);
  return u.username === 'postgres.abc' && u.password === 'pw'
    && u.hostname === 'aws-0-us-east-1.pooler.supabase.com'
    && u.port === '5432' && u.pathname === '/postgres';
})());
// Swallowing a bad DATABASE_URL turns a clear startup error into a mystery.
check('an unparseable URL is passed through for Prisma to reject',
  tunePoolForServerless('not a url') === 'not a url');
check('an unset URL stays unset', tunePoolForServerless(undefined) === undefined);

console.log('\n4b. A malformed URL says what is wrong with it, and leaks nothing');
// Prisma's own message points at a correct line of schema, never shows the
// value, and never says what is wrong with it — so one bad character in a
// dashboard reads as "the database is broken".
const SECRET = 'sup3rs3cr3t-p4ssw0rd';
const shapeOf = (input: string) => {
  const lines: string[] = [];
  const realError = console.error;
  console.error = (...a: unknown[]) => { lines.push(a.map(String).join(' ')); };
  try { tunePoolForServerless(input); } finally { console.error = realError; }
  return lines.join('\n');
};

check('a value wrapped in quotes is named as such',
  /wrapped in quote characters/.test(shapeOf(`"postgresql://u:${SECRET}@h:6543/db"`)));
check('a psql-prefixed value is distinguished from a bad scheme',
  /contains :\/\/ but does not start with a scheme/.test(shapeOf(`psql "postgresql://u:${SECRET}@h:6543/db"`)));
check('a value that is not a connection string at all is called out',
  /no :\/\/ found/.test(shapeOf(SECRET)));
check('the reported length helps spot a truncated paste',
  /length=\d+/.test(shapeOf('not-a-url')));
// A connection string is a credential and this runs on a production log.
check('the diagnostic NEVER prints the value', (() => {
  // Every input that a real misconfiguration could produce, whether or not it
  // happens to parse. Nothing derived from the content may reach the log.
  const inputs = [
    `"postgresql://user:${SECRET}@h:6543/db"`,
    `psql postgresql://user:${SECRET}@h:6543/db`,
    SECRET,
    `  ${SECRET}  `,
    `DATABASE_URL=postgresql://user:${SECRET}@h:6543/db`,
    // This one PARSES — URL tolerates the trailing junk — so it must emit
    // nothing at all. Asserted separately below.
    `postgresql://user:${SECRET}@h:6543/db\n\n{`,
  ];
  return inputs.every((i) => {
    const out = shapeOf(i);
    return !out.includes(SECRET) && !out.includes('user');
  });
})());
// Emission is a separate property from leakage: the malformed ones must speak.
check('every genuinely malformed value produces a diagnostic', (() => {
  const malformed = [
    `"postgresql://user:${SECRET}@h:6543/db"`,
    `psql postgresql://user:${SECRET}@h:6543/db`,
    SECRET,
    `DATABASE_URL=postgresql://user:${SECRET}@h:6543/db`,
  ];
  return malformed.every((i) => shapeOf(i).length > 0);
})());
// A URL that parses must stay silent — a warning on every healthy boot is noise
// that trains you to ignore the one that matters.
check('a valid URL produces no diagnostic at all',
  shapeOf('postgresql://u:p@h:6543/db') === '');

console.log('\n5. One client per process, whatever the bundler does');
const client = readFileSync('src/lib/prisma.ts', 'utf8');
// This used to be `if (NODE_ENV !== "production")`, where its only job was
// surviving dev hot-reload. With 684 importers split across production route
// chunks, a module emitted into several chunks runs several top-level
// `new PrismaClient()` calls — one process, several pools.
check('the globalThis cache is unconditional, not dev-only',
  /^globalForPrisma\.prisma = prisma;$/m.test(client)
  && !/NODE_ENV !== "production"\s*\)\s*\{\s*globalForPrisma/.test(client));
check('exactly one PrismaClient is constructed in the app', (() => {
  const hits = execSync("grep -rl 'new PrismaClient' --include=*.ts --include=*.tsx src/ || true",
    { encoding: 'utf8' }).split('\n').filter(Boolean);
  return hits.length === 1 && hits[0] === 'src/lib/prisma.ts';
})());
check('the client is constructed with the tuned URL, not the raw env var',
  /const tunedUrl = tunePoolForServerless\(process\.env\.DATABASE_URL\)/.test(client)
  && /datasources: \{ db: \{ url: tunedUrl \} \}/.test(client));
// `url: undefined` is a constructor error, not a fallback. Passing it when
// DATABASE_URL is unset turns a missing env var into a crash at import time.
check('a missing DATABASE_URL does not become a crash at import time',
  /\.\.\.\(tunedUrl \? \{ datasources/.test(client));

console.log(failures === 0
  ? '\nAll db-pool checks passed.\n'
  : `\n${failures} check(s) failed.\n`);
process.exit(failures === 0 ? 0 : 1);
