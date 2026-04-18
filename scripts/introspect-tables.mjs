// Read-only introspection helper. Dumps column/index/constraint metadata for named tables.
// Usage: node --env-file=.env.local scripts/introspect-tables.mjs table1 table2 ...
// Also lists all matching tables with a prefix if arg is `PREFIX:*`.

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient({ datasourceUrl: process.env.DIRECT_URL || process.env.DATABASE_URL });

const args = process.argv.slice(2);
if (!args.length) { console.error('no targets'); process.exit(1); }

// Expand any "PREFIX:*" args
const targets = [];
for (const a of args) {
  if (a.endsWith(':*')) {
    const prefix = a.slice(0, -2);
    const r = await prisma.$queryRawUnsafe(
      `SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE $1 ORDER BY table_name`,
      prefix + '%'
    );
    r.forEach(row => targets.push(row.table_name));
  } else {
    targets.push(a);
  }
}

const out = {};
for (const t of targets) {
  const entry = { table: t };
  const cols = await prisma.$queryRawUnsafe(
    `SELECT column_name, data_type, udt_name, is_nullable, column_default, character_maximum_length
     FROM information_schema.columns
     WHERE table_schema='public' AND table_name=$1
     ORDER BY ordinal_position`, t);
  entry.columns = cols;
  const idx = await prisma.$queryRawUnsafe(
    `SELECT indexname, indexdef FROM pg_indexes WHERE schemaname='public' AND tablename=$1 ORDER BY indexname`, t);
  entry.indexes = idx;
  const cons = await prisma.$queryRawUnsafe(
    `SELECT conname, pg_get_constraintdef(c.oid) AS def
     FROM pg_constraint c
     JOIN pg_class cl ON cl.oid = c.conrelid
     JOIN pg_namespace n ON n.oid = cl.relnamespace
     WHERE n.nspname='public' AND cl.relname=$1
     ORDER BY conname`, t);
  entry.constraints = cons;
  out[t] = entry;
}

// Also list any enum types whose name contains keywords
const enums = await prisma.$queryRawUnsafe(
  `SELECT t.typname AS name, array_agg(e.enumlabel ORDER BY e.enumsortorder) AS values
   FROM pg_type t
   JOIN pg_namespace n ON n.oid = t.typnamespace
   JOIN pg_enum e ON e.enumtypid = t.oid
   WHERE n.nspname='public' AND t.typtype='e'
   GROUP BY t.typname
   ORDER BY t.typname`
);
out._all_enums = enums;

console.log(JSON.stringify(out, null, 2));
await prisma.$disconnect();
