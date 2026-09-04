/**
 * The pre-migration snapshot. Second link in migrate:safe, and only there.
 *
 * Position is the whole specification: `migrate:safe` is
 * `db:guard && db:backup && prisma migrate dev` — the one chain that applies
 * destructive SQL to a database with data in it. `migrate:create-only` writes no
 * SQL and `migrate:deploy` targets production, where backups are infrastructure
 * rather than a script. So this protects a developer's database, immediately
 * before the statement that can lose data.
 *
 * FAILS CLOSED, and that is the entire contract. Exit 0 means a backup exists on
 * disk; the `&&` then lets the migration run. Any other outcome — no pg_dump, no
 * connection, a dump that errored, a dump that came back empty — exits 1 and the
 * migration never starts. A backup script that lets the chain continue when it
 * could not take a backup is worse than no backup script, because it converts
 * "I have no snapshot" into "I believe I have a snapshot".
 *
 * Run: npm run db:backup    (or automatically, via npm run migrate:safe)
 */

import { spawnSync } from 'child_process';
import { existsSync, mkdirSync, writeFileSync, statSync } from 'fs';
import path from 'path';
// The same decision every other schema-touching script makes, made in one place.
// A backup read through a transaction pooler is not a hazard the way DDL is, but
// the direct connection is the one that can actually see everything.
import { migrationConnectionUrl } from './lib/migrationConnection.mjs';

const OUT_DIR = process.env.FOLIO_BACKUP_DIR ?? '.backups';

const die = (name: string, detail: string): never => {
  console.error(`  FAIL  ${name}\n        ${detail.split('\n').join('\n        ')}`);
  console.error('\nNo backup taken. Migration NOT started.\n');
  process.exit(1);
};

console.log('\ndb:backup — pre-migration snapshot\n');

// ── 1. pg_dump has to exist ──────────────────────────────────────────────────
const version = spawnSync('pg_dump', ['--version'], { encoding: 'utf8' });
if (version.error || version.status !== 0) {
  die(
    'pg_dump is available',
    'pg_dump is not on PATH, so no snapshot can be taken.\n' +
    'Install the postgresql client tools, or set FOLIO_BACKUP_DIR and take the\n' +
    'snapshot another way before running migrate:safe.',
  );
}
console.log(`  PASS  pg_dump is available — ${(version.stdout ?? '').trim()}`);

// ── 2. A connection to dump ──────────────────────────────────────────────────
const url = migrationConnectionUrl({ label: 'db:backup', readOnly: true });
let dbName = 'database';
try {
  dbName = new URL(url).pathname.replace(/^\//, '') || 'database';
} catch {
  die('the connection string is a parseable URL', 'could not parse the resolved connection string');
}
console.log(`  PASS  connection resolved — ${dbName}`);

// ── 3. Somewhere to put it that will not be committed ────────────────────────
// The directory ignores itself rather than requiring a repo .gitignore entry, so
// a snapshot can never be added to a commit by an absent-minded `git add -A`.
if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
const selfIgnore = path.join(OUT_DIR, '.gitignore');
if (!existsSync(selfIgnore)) writeFileSync(selfIgnore, '*\n');

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const outFile = path.join(OUT_DIR, `${dbName}-${stamp}.sql`);

// ── 4. The dump ──────────────────────────────────────────────────────────────
// --no-owner / --no-privileges so the dump restores into a differently-owned
// database, which is the normal case when restoring a developer snapshot.
console.log(`  ....  dumping to ${outFile}`);
const dump = spawnSync(
  'pg_dump',
  ['--no-owner', '--no-privileges', '--format=plain', '--file', outFile, url],
  { encoding: 'utf8', env: process.env },
);

if (dump.error) die('pg_dump ran', String(dump.error.message));
if (dump.status !== 0) {
  die('pg_dump completed', `exit ${dump.status}\n${(dump.stderr ?? '').trim().split('\n').slice(0, 10).join('\n')}`);
}
if (!existsSync(outFile)) die('the dump file exists', `pg_dump reported success but ${outFile} is not there`);

// An empty or near-empty file is pg_dump succeeding at nothing. The threshold is
// deliberately crude: a real schema dump of this database is hundreds of KB, and
// anything under a kilobyte is a failure that exited 0.
const bytes = statSync(outFile).size;
if (bytes < 1024) {
  die('the dump has content', `${outFile} is ${bytes} bytes — that is not a backup of this schema`);
}

console.log(`  PASS  snapshot written — ${outFile} (${(bytes / 1024 / 1024).toFixed(1)} MB)`);
console.log('\nBackup complete. Proceeding.\n');
process.exit(0);
