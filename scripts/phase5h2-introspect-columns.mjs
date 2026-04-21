import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const tables = [
  'project_product_tags', 'meeting_notes', 'vendors', 'vendor_preview_tokens',
  'pending_rep_invites', 'vendor_product_match_scores', 'room_intents',
  'project_lifecycle_scores', 'project_intents', 'designer_activity_profiles',
  'proximity_to_purchase_indicators', 'follows', 'editorial_drafts',
];

const out = {};
for (const t of tables) {
  const cols = await prisma.$queryRawUnsafe(
    `SELECT column_name, data_type, udt_name, character_maximum_length,
            numeric_precision, numeric_scale, datetime_precision,
            is_nullable, column_default
     FROM information_schema.columns
     WHERE table_schema='public' AND table_name=$1
     ORDER BY ordinal_position`, t);
  const idx = await prisma.$queryRawUnsafe(
    `SELECT indexname, indexdef FROM pg_indexes
     WHERE schemaname='public' AND tablename=$1
     ORDER BY indexname`, t);
  const fks = await prisma.$queryRawUnsafe(
    `SELECT tc.constraint_name, kcu.column_name, ccu.table_name AS foreign_table,
            ccu.column_name AS foreign_column, rc.delete_rule, rc.update_rule
     FROM information_schema.table_constraints tc
     JOIN information_schema.key_column_usage kcu
       ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
     JOIN information_schema.constraint_column_usage ccu
       ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
     JOIN information_schema.referential_constraints rc
       ON rc.constraint_name = tc.constraint_name AND rc.constraint_schema = tc.table_schema
     WHERE tc.constraint_type='FOREIGN KEY' AND tc.table_schema='public' AND tc.table_name=$1
     ORDER BY tc.constraint_name`, t);
  out[t] = { columns: cols, indexes: idx, foreignKeys: fks };
}

console.log(JSON.stringify(out, null, 2));
await prisma.$disconnect();
