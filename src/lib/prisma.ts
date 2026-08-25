// ============================================================================
// The Prisma client, and the two things that exhaust a connection pool.
//
// Symptom this exists to prevent:
//
//   FATAL: (EMAXCONNSESSION) max clients reached in session mode
//          — max clients are limited to pool_size: 15
//
// Every route 500s at once, and it clears itself roughly half an hour later
// with no deploy and no fix. That self-healing is the tell: nothing was
// repaired, the connection holders simply aged out.
//
// The arithmetic, on a serverless host:
//
//   Prisma's DEFAULT connection_limit is `num_cpus * 2 + 1`. A Vercel lambda
//   reports one or two CPUs, so each INSTANCE opens three to five connections
//   and holds them for as long as it stays warm.
//
//   Supavisor's session-mode pool is 15. In session mode a client connection
//   is pinned to a Postgres backend for the life of the session — there is no
//   multiplexing to absorb the overshoot.
//
//   So three to five simultaneously warm instances is the ceiling. Ordinarily
//   traffic keeps you under it. A DEPLOY does not: the previous version's
//   instances go on holding their connections until they idle out while the new
//   version's instances are warming, so for a window you are running two fleets
//   against one pool of 15. That window is the "wait half an hour before you can
//   test anything" — it ends when the old instances are reaped, which is also
//   why waiting works and why nothing you change appears to matter.
//
// Both halves are handled here, at the one place every caller already goes
// through, because a fix that depends on remembering to set an environment
// variable correctly is a fix that regresses on the next environment.
// ============================================================================

import { PrismaClient } from "@prisma/client";

/**
 * Cap what a single instance may hold, and say so in the URL.
 *
 * Prisma takes these from the connection string; there is no constructor option
 * for pool size. Anything already spelled out in the URL is left exactly as it
 * is — an explicit setting is somebody's decision, and this is a default, not an
 * override.
 *
 * connection_limit=1 is the right default in serverless and is not the
 * throughput loss it looks like: a lambda serves one request at a time, so the
 * extra connections in a default-sized pool are not serving concurrency within
 * the instance. They are idle, and in session mode idle still means held.
 */
/**
 * Say what is wrong with a malformed connection string WITHOUT printing it.
 *
 * Structural facts only. A connection string is a credential, and this runs on a
 * production log — so nothing derived from the value's content is emitted, not
 * even a prefix. That rules out the obvious "log the first 20 characters", which
 * leaks the password outright if the variable was set to a bare secret.
 *
 * The flags below are enough to identify every cause seen in practice, because
 * each has a distinct signature: quotes pasted along with the value, a `psql `
 * prefix copied from the CLI tab, a trailing newline from a text editor, or a
 * value that is simply not a URL at all.
 */
function describeUrlShape(raw: string): string {
  const facts: string[] = [`length=${raw.length}`];
  if (raw !== raw.trim()) facts.push("has leading/trailing whitespace");
  if (/[\r\n]/.test(raw)) facts.push("contains a newline");
  const trimmed = raw.trim();
  // Curly quotes as well as straight ones. A value copied out of anything that
  // renders text — a doc, a rendered web page, a chat message — arrives with
  // \u201c and \u201d, and a check for " alone reports nothing while the value is
  // just as broken.
  if (/^["'\u2018\u2019\u201c\u201d]|["'\u2018\u2019\u201c\u201d]$/.test(trimmed)) {
    facts.push("wrapped in quote characters");
  }

  const scheme = trimmed.match(/^([A-Za-z][A-Za-z0-9+.-]*):\/\//);
  if (scheme) {
    facts.push(`scheme="${scheme[1]}"`);
  } else if (trimmed.includes("://")) {
    // Something precedes the scheme. Name it: the text BEFORE :// is
    // structurally not a credential — user and password come after it — so
    // printing it is safe, and it is the one piece that identifies the mistake.
    // "contains :// but does not start with a scheme" fits `DATABASE_URL=...`,
    // `psql ...`, a smart quote, and an invisible character equally well, which
    // makes it a prompt for another round of guessing rather than an answer.
    facts.push(`text before :// is ${describePrefix(trimmed.slice(0, trimmed.indexOf("://")))}`);
  } else {
    facts.push("no :// found — this does not look like a connection string");
  }
  return facts.join(", ");
}

/**
 * The prefix, made visible.
 *
 * Escaped rather than printed raw, because the likeliest invisible causes — a
 * zero-width space picked up from a rendered page, a stray control character —
 * are invisible in a log too, and a diagnostic that prints them looks identical
 * to one reporting nothing wrong. Bounded, so a value that happens to contain
 * :// somewhere in a secret cannot dump that secret into the log.
 */
function describePrefix(prefix: string): string {
  const LIMIT = 32;
  if (prefix.length > LIMIT) return `${prefix.length} characters long`;
  const escaped = prefix.replace(/[^\x20-\x7e]/g, (ch) =>
    `\\u${ch.charCodeAt(0).toString(16).padStart(4, "0")}`);
  return `"${escaped}"`;
}

export function tunePoolForServerless(raw: string | undefined): string | undefined {
  if (!raw) return raw;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    // Not parseable as a URL. Hand it to Prisma untouched — swallowing it here
    // would be worse — but say something first, because Prisma's complaint on
    // its own is nearly undiagnosable:
    //
    //   Error validating datasource `db`: the URL must start with the protocol
    //   `postgresql://` [...] --> schema.prisma:7
    //
    // It points at a line of schema that is correct, never shows the value, and
    // never says what is wrong with it. Every realistic cause — a pasted pair of
    // quotes, a `psql ` prefix, a stray newline, the wrong variable's value — is
    // invisible from that message, so the failure reads as "the database is
    // broken" when it is one bad character in a dashboard.
    console.error(`[prisma] DATABASE_URL is not a parseable URL — ${describeUrlShape(raw)}`);
    return raw;
  }

  const params = url.searchParams;

  if (!params.has("connection_limit")) {
    params.set("connection_limit", process.env.PRISMA_CONNECTION_LIMIT ?? "1");
  }

  // Port 6543 is Supavisor's TRANSACTION pooler. Prepared statements do not
  // survive there, because a transaction-mode connection is handed to a
  // different backend between statements — pgbouncer=true is what tells Prisma
  // to stop using them. Without it the symptom is not a pool error but random
  // "prepared statement s0 already exists" failures.
  if (url.port === "6543" && !params.has("pgbouncer")) {
    params.set("pgbouncer", "true");
  }

  url.search = params.toString();
  return url.toString();
}

/**
 * One client per process, shared across bundles.
 *
 * The globalThis cache used to be conditional on NODE_ENV !== "production",
 * which is the pattern every Next.js example ships — and in that pattern its
 * only job is surviving dev hot-reload, since a module is evaluated once per
 * process anyway.
 *
 * That assumption does not hold here. `src/lib/prisma.ts` has 684 importers
 * spread across route handlers, and the production build splits them into
 * separate server chunks. A module reachable from several chunks can be emitted
 * into several of them, and each copy runs its own top-level `new
 * PrismaClient()` — one process, several clients, each opening its own pool.
 * The connection count per instance then multiplies by however many chunks
 * happened to inline it.
 *
 * Caching on globalThis unconditionally makes every copy resolve to the first
 * one, which is what the pattern was always assuming and only got for free in
 * development.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// Override the datasource ONLY when there is something to override it with.
// `datasources: { db: { url: undefined } }` is a constructor error, not a
// fallback — passing it when DATABASE_URL is unset would turn a missing
// environment variable into a crash at import time, several layers away from
// the thing that is actually wrong. With the key absent, Prisma resolves
// env("DATABASE_URL") from the schema itself and reports it properly.
const tunedUrl = tunePoolForServerless(process.env.DATABASE_URL);

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    ...(tunedUrl ? { datasources: { db: { url: tunedUrl } } } : {}),
  });

globalForPrisma.prisma = prisma;

// Support BOTH import styles:
//   import { prisma } from "@/lib/prisma"
//   import prisma from "@/lib/prisma"
export default prisma;
