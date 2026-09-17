// Metadata only. Never selects application rows or prints connection configuration.
require('dotenv').config({ path: '.env.local', quiet: true });
require('dotenv').config({ path: '.env', quiet: true });
const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient({ log: [] });
const tables = ['users', 'organizations', 'projects', 'project_posts', 'editorial_queue_items',
  'instagram_campaigns', 'instagram_campaign_posts', 'editorial_stories', 'editorial_story_revisions',
  'editorial_story_answers', 'editorial_story_sources', 'social_pieces', 'social_piece_versions',
  'social_campaigns', 'social_campaign_items'];
(async () => {
  const result = await db.$transaction(async tx => {
    await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
    await tx.$executeRawUnsafe("SET LOCAL statement_timeout = '15000ms'");
    const columns = await tx.$queryRawUnsafe(`
      SELECT table_name,column_name,data_type,udt_name,is_nullable
      FROM information_schema.columns
      WHERE table_schema='public' AND table_name=ANY($1::text[])
      AND (table_name NOT IN ('users','organizations','projects') OR column_name IN ('id','ownerId','designerId','designerOrgId'))
      ORDER BY table_name,ordinal_position`, tables);
    const constraints = await tx.$queryRawUnsafe(`
      SELECT c.relname AS table_name,co.conname,co.contype,pg_get_constraintdef(co.oid) AS definition
      FROM pg_constraint co JOIN pg_class c ON c.oid=co.conrelid
      JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname=ANY($1::text[])
      AND (c.relname NOT IN ('users','organizations','projects') OR co.contype='p')
      ORDER BY c.relname,co.conname`, tables);
    const migrations = await tx.$queryRawUnsafe(`SELECT count(*)::int AS recorded,
      count(*) FILTER(WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL)::int AS applied,
      count(*) FILTER(WHERE finished_at IS NULL AND rolled_back_at IS NULL)::int AS unfinished
      FROM _prisma_migrations`);
    return { columns, constraints, migrations };
  }, { timeout: 60000, maxWait: 15000 });
  console.log(JSON.stringify(result, null, 2));
})().catch(error => {
  console.error('Read-only Studio metadata recon failed:', error.code || error.name || 'UnknownError');
  process.exitCode = 1;
}).finally(() => db.$disconnect());
