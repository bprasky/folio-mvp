// Targeted introspection — columns/indexes/constraints for specific tables, no enum dump.
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient({ datasourceUrl: process.env.DIRECT_URL || process.env.DATABASE_URL });

const tables = process.argv.slice(2);
if (!tables.length) { console.error('no tables'); process.exit(1); }

const out = {};
for (const t of tables) {
  const cols = await prisma.$queryRawUnsafe(
    `SELECT column_name, data_type, udt_name, is_nullable, column_default
     FROM information_schema.columns
     WHERE table_schema='public' AND table_name=$1
     ORDER BY ordinal_position`, t);
  const idx = await prisma.$queryRawUnsafe(
    `SELECT indexname, indexdef FROM pg_indexes WHERE schemaname='public' AND tablename=$1 ORDER BY indexname`, t);
  const cons = await prisma.$queryRawUnsafe(
    `SELECT conname, pg_get_constraintdef(c.oid) AS def
     FROM pg_constraint c
     JOIN pg_class cl ON cl.oid = c.conrelid
     JOIN pg_namespace n ON n.oid = cl.relnamespace
     WHERE n.nspname='public' AND cl.relname=$1
     ORDER BY conname`, t);
  out[t] = { columns: cols, indexes: idx, constraints: cons };
}
console.log(JSON.stringify(out, null, 2));
await prisma.$disconnect();
