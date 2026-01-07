-- ============================================================
-- Manual Migration: Resolve Failed Migration
-- ============================================================
-- If migration 20251029152414_init_context_graph failed,
-- you may need to mark it as rolled back or applied
-- ============================================================

-- Option 1: If the migration partially applied, check what tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN (
    'context_signals',
    'embeddings', 
    'graph_edges',
    'market_signals',
    'spend_recommendations'
  )
ORDER BY table_name;

-- Option 2: If tables ALREADY EXIST (which is your case),
-- mark the migration as successfully applied:

-- Step 1: Verify tables exist
SELECT 
    'Tables Check' as check_type,
    COUNT(*) as existing_tables
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN (
    'context_signals',
    'embeddings', 
    'graph_edges',
    'market_signals',
    'spend_recommendations'
  );

-- Step 2: Mark migration as applied (since tables exist)
UPDATE "_prisma_migrations" 
SET 
    finished_at = NOW(),
    rolled_back_at = NULL,
    applied_steps_count = 1,
    logs = 'Manually resolved: Tables already existed, marked as applied'
WHERE migration_name = '20251029152414_init_context_graph' 
  AND finished_at IS NULL;

-- Step 3: Verify
SELECT 
    migration_name,
    finished_at,
    rolled_back_at,
    applied_steps_count
FROM "_prisma_migrations" 
WHERE migration_name = '20251029152414_init_context_graph'
ORDER BY started_at DESC
LIMIT 1;

-- Option 3: If tables DON'T exist and migration should be rolled back:
-- UPDATE "_prisma_migrations" 
-- SET finished_at = NOW(), 
--     rolled_back_at = NOW(),
--     logs = 'Manually marked as rolled back'
-- WHERE migration_name = '20251029152414_init_context_graph' 
--   AND finished_at IS NULL;

