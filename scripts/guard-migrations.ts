/**
 * The pre-apply gate. First link in migrate:safe, migrate:create-only and
 * migrate:deploy.
 *
 * Bare invocation, no arguments, no interactivity — all three chains front it
 * identically with `npm run db:guard && …`, so it cannot know which one called
 * it and must only assert things that are true before ANY of them. Exit 0 to let
 * the chain proceed, exit 1 to stop it.
 *
 * WHAT THIS DELIBERATELY DOES NOT CHECK. `.github/workflows/migration-
 * discipline.yml` already runs `scripts/phase5e-check-plan.mjs --ci` over loose
 * SQL at the migrations root, phantom `prisma.<model>` calls, folders missing a
 * migration.sql, and non-idempotent DDL. Every one of those is a property of the
 * files, answerable with no database, and CI answers it on every PR. Repeating
 * them here would slow the gate down to re-derive an answer that is already
 * enforced. This checks the half CI cannot see: the thing being migrated.
 *
 * Run: npm run db:guard
 */

import { spawnSync } from 'child_process';
import path from 'path';
// Reused, not reimplemented. This module is what already decides whether a
// connection is safe for schema work, and seven scripts depend on that decision
// being made in exactly one place.
import { migrationConnectionUrl } from './lib/migrationConnection.mjs';
import { loadProjectEnv } from './lib/loadEnv.mjs';

let failures = 0;
const fail = (name: string, detail: string) => {
  failures++;
  console.error(`  FAIL  ${name}\n        ${detail.split('\n').join('\n        ')}`);
};
const pass = (name: string, detail?: string) => {
  console.log(`  PASS  ${name}${detail ? `\n        ${detail}` : ''}`);
};

/**
 * The path to the Prisma CLI this project installed.
 *
 * Throws rather than returning a guess: a guard that cannot find the tool it
 * checks with must say so, not skip the check.
 */
function prismaCli(): string {
  const pkgPath = require.resolve('prisma/package.json', { paths: [process.cwd()] });
  const bin = require(pkgPath).bin;
  const rel = typeof bin === 'string' ? bin : bin?.prisma;
  if (!rel) throw new Error('prisma/package.json declares no `prisma` bin entry');
  return path.join(path.dirname(pkgPath), rel);
}

/** Host, port and database, with any credentials dropped. Safe to print. */
function describe(raw: string): { label: string; host: string; port: string; db: string } | null {
  try {
    const u = new URL(raw);
    const db = u.pathname.replace(/^\//, '') || '(none)';
    const port = u.port || '5432';
    return { label: `${u.hostname}:${port}/${db}`, host: u.hostname, port, db };
  } catch {
    return null;
  }
}

// Before anything reads process.env. The chains invoke this bare, so there is no
// --env-file to pass, and `prisma migrate deploy` two links later reads `.env`
// on its own — a gate that could not see the same connection as the command it
// gates would refuse work that was never unsafe.
const envFiles = loadProjectEnv();

console.log('\ndb:guard — pre-apply checks\n');
console.log(
  envFiles.length > 0
    ? `  ....  env loaded from ${envFiles.join(', ')}`
    : '  ....  no .env.local or .env found; using the ambient environment only',
);

// ─── 1. Connection safety for `prisma migrate` itself ────────────────────────
//
// prisma/schema.prisma declares `directUrl = env("DIRECT_URL")`, so Prisma uses
// DIRECT_URL when it is set and silently falls back to the pooled DATABASE_URL
// when it is not. That fallback is the hazard: transaction pooling hands each
// statement to a different backend, so migrate's advisory lock is not held and
// multi-statement DDL can half-apply while reporting success.
//
// migrationConnectionUrl exits 1 on exactly that case, which is the behaviour
// this gate wants. It protects the repo's own scripts already; what it has never
// covered is `prisma migrate` itself, because Prisma reads the URL from the
// schema rather than from this module. Calling it here closes that gap.
const target = migrationConnectionUrl({ label: 'db:guard (pre-apply gate)', readOnly: false });
const targetInfo = describe(target);
if (!targetInfo) {
  fail('the migration target is a parseable URL', `could not parse the resolved connection string`);
} else {
  pass('the connection is safe for schema work', `target: ${targetInfo.label}`);
}

// ─── 2. Target identity ──────────────────────────────────────────────────────
//
// Not "is this the right database" — no non-interactive check can know that. It
// is the weaker, checkable claim: the database migrations are about to be
// applied to is the same one the application reads. DIRECT_URL and DATABASE_URL
// pointing at different databases means the schema moves under one and the app
// talks to the other, and nothing else in the repo would notice.
const appUrl = process.env.DATABASE_URL;
const appInfo = appUrl ? describe(appUrl) : null;

if (!appInfo || !targetInfo) {
  pass('target identity', 'skipped — only one connection string is set');
} else if (appInfo.db !== targetInfo.db) {
  fail(
    'the migration target and the app database are the same database',
    `DIRECT_URL  -> ${targetInfo.label}\n` +
    `DATABASE_URL -> ${appInfo.label}\n` +
    `\n` +
    `Migrating one while the app reads the other applies schema nobody will see.`,
  );
} else {
  // Supavisor rewrites the hostname for pooled connections, so the host differs
  // legitimately between the direct and pooled URL for the same project. The
  // database name is the part that must agree.
  pass('the migration target is the app database', `database: ${targetInfo.db}`);
}

// ─── 3. Migration bookkeeping is clean ───────────────────────────────────────
//
// CLAUDE.md's runbook is built on a three-way check — declared in schema.prisma,
// exists in prod, recorded in _prisma_migrations. CI can only see the first.
// `prisma migrate status` is the other two, and it is the check that catches a
// half-applied or failed migration BEFORE another one is stacked on top of it.
//
// Exit codes: 0 = up to date. Non-zero = pending, failed, or drifted. The text
// is parsed only to say which, because the exit code alone does not distinguish
// "pending migrations" (often fine before a deploy) from "failed migration"
// (never fine).
//
// Invoked through `node <prisma's own bin entry>` rather than `npx prisma`.
// `spawnSync('npx', …)` looks up a bare name on PATH, and on Windows the
// executable is `npx.cmd` — spawnSync without a shell does not try the PATHEXT
// extensions, so it fails ENOENT on exactly the machine that runs the migration.
// Reported from one. Resolving the bin out of prisma's own package.json needs no
// PATH, no shell, and no per-platform filename, and it pins the CLI to the
// version this project installed instead of whatever npx would fetch.
const status = spawnSync(process.execPath, [prismaCli(), 'migrate', 'status'], {
  encoding: 'utf8',
  env: process.env,
});
const statusText = `${status.stdout ?? ''}${status.stderr ?? ''}`;

if (status.error) {
  fail('prisma migrate status ran', String(status.error.message));
} else if (status.status === 0) {
  pass('migration bookkeeping is clean', 'database schema is up to date');
} else if (/failed migrations?|in a failed state|`prisma migrate resolve`/i.test(statusText)) {
  fail(
    'no migration is in a failed state',
    'A previous migration failed and was never resolved. Applying another one on\n' +
    'top of it is how a schema ends up in a state nobody wrote down. Resolve it\n' +
    'first — see CLAUDE.md, "When drift is reintroduced (runbook)".\n\n' +
    statusText.trim().split('\n').slice(0, 12).join('\n'),
  );
} else if (/drift|not (?:yet )?(?:been )?applied to the database|have not yet been applied/i.test(statusText)) {
  fail(
    'the database matches the migration history',
    'Pending or drifted migrations. Apply or reconcile them before adding another.\n\n' +
    statusText.trim().split('\n').slice(0, 12).join('\n'),
  );
} else {
  fail(
    'prisma migrate status reports a clean database',
    `exit ${status.status}\n\n${statusText.trim().split('\n').slice(0, 12).join('\n')}`,
  );
}

console.log(
  failures === 0
    ? '\nPre-apply checks passed. Proceeding.\n'
    : `\n${failures} pre-apply check(s) failed. Migration NOT started.\n`,
);
process.exit(failures === 0 ? 0 : 1);
