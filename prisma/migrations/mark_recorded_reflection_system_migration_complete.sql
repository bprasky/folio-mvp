-- ============================================================
-- MARK RECORDED REFLECTION SYSTEM MIGRATION AS COMPLETE
-- ============================================================
-- Run this AFTER running add_recorded_reflection_system.sql
-- This tells Prisma that the migration has been applied
-- ============================================================

-- Generate a timestamp for the migration name (format: YYYYMMDDHHMMSS)
-- Using: 20250127120000 (January 27, 2025, 12:00:00)
-- Adjust the timestamp if needed to match your actual migration time

-- Only insert if it doesn't already exist
INSERT INTO "_prisma_migrations" (
  "id",
  "checksum",
  "finished_at",
  "migration_name",
  "logs",
  "rolled_back_at",
  "started_at",
  "applied_steps_count"
)
SELECT 
  gen_random_uuid(),  -- Generate unique ID
  '',  -- Checksum - Prisma will recalculate if needed, empty is safe
  NOW(),  -- Finished timestamp
  '20250127120000_add_recorded_reflection_system',  -- Migration name (timestamp_prefix_name)
  NULL,  -- No logs
  NULL,  -- Not rolled back
  NOW(),  -- Started timestamp (same as finished since we're backdating)
  1  -- Applied steps count
WHERE NOT EXISTS (
  SELECT 1 FROM "_prisma_migrations" 
  WHERE "migration_name" = '20250127120000_add_recorded_reflection_system'
);

-- Verify the migration was recorded:
-- SELECT * FROM "_prisma_migrations" WHERE "migration_name" LIKE '%recorded_reflection%';

-- After running this, regenerate Prisma client:
-- npx prisma generate




