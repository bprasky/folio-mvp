// ============================================================================
// Which connection a migration or introspection script is allowed to use.
//
// Every script here reaches for `DIRECT_URL || DATABASE_URL`. That fallback was
// harmless while both pointed at the same kind of connection. It stopped being
// harmless the moment DATABASE_URL moved to Supavisor's TRANSACTION pooler
// (port 6543), because transaction pooling does not give a script a connection
// — it gives it a different backend per statement.
//
// What that breaks, specifically:
//
//   ADVISORY LOCKS. `prisma migrate` takes one to guarantee a single migration
//   runs at a time. A session-level lock taken on one backend is not held on the
//   next, so the lock silently does nothing and two concurrent runs can apply
//   the same migration.
//
//   MULTI-STATEMENT DDL. A migration.sql that is not wrapped in an explicit
//   transaction has its statements spread across backends. Half of it lands.
//   That is the shape of drift Phases 1-5D spent weeks unwinding, and it would
//   arrive looking like a successful run.
//
// So the fallback is now allowed only where it is safe, and refused where it
// corrupts. A refusal here costs one environment variable; the failure it
// prevents costs a hand-reconciled production schema.
// ============================================================================

/**
 * A URL is transaction-pooled if it is on Supavisor's transaction port or has
 * told Prisma to stop using prepared statements — either way, statements are
 * not guaranteed to reach the same backend.
 */
function isTransactionPooled(raw) {
  try {
    const url = new URL(raw);
    return url.port === '6543' || url.searchParams.get('pgbouncer') === 'true';
  } catch {
    return false;
  }
}

/**
 * The connection to run schema work over.
 *
 * DIRECT_URL when it is set — that is what it is for. Otherwise DATABASE_URL,
 * but only after checking what the script intends to do with it.
 *
 * `readOnly: true` says this script only runs SELECTs. Those are correct through
 * a transaction pooler — each statement is self-contained, so it does not matter
 * which backend serves it — and the recon step of the migration runbook is
 * entirely read-only. Refusing there would block the audit scripts for a hazard
 * they cannot hit. They still warn, because reading prod through a pooler is
 * worth knowing about.
 *
 * The default is the strict one: a script that writes DDL and has no DIRECT_URL
 * is stopped.
 *
 * Exits rather than throwing — these are CLI scripts, and a stack trace would
 * bury the one line that says what to do about it.
 */
export function migrationConnectionUrl({ label = 'This script', readOnly = false } = {}) {
  const direct = process.env.DIRECT_URL;
  if (direct) return direct;

  const database = process.env.DATABASE_URL;
  if (!database) {
    console.error(`ERR: neither DIRECT_URL nor DATABASE_URL is set. ${label} needs a database to talk to.`);
    process.exit(1);
  }

  if (isTransactionPooled(database)) {
    if (readOnly) {
      console.warn(
        `WARN: DIRECT_URL is not set, so ${label} is reading through the transaction\n` +
        `      pooler. Correct for SELECTs, but set DIRECT_URL if you want recon to\n` +
        `      go straight at the database.`,
      );
      return database;
    }
    console.error(
      `ERR: DIRECT_URL is not set, and DATABASE_URL is transaction-pooled.\n` +
      `\n` +
      `${label} writes schema, which needs a real session. Transaction pooling hands\n` +
      `each statement to a different backend, so advisory locks are not held and\n` +
      `multi-statement DDL can half-apply — reporting success while leaving the\n` +
      `schema in a state nobody wrote down.\n` +
      `\n` +
      `Set DIRECT_URL to the direct connection (port 5432) and run this again.`,
    );
    process.exit(1);
  }

  console.warn(
    `WARN: DIRECT_URL is not set; falling back to DATABASE_URL.\n` +
    `      It is not transaction-pooled, so this is safe — but set DIRECT_URL\n` +
    `      so the fallback is never what is protecting you.`,
  );
  return database;
}
