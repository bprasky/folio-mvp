-- Mark Project Archive Fields migration as complete in Prisma migrations table
-- Run this AFTER running the add_project_archive_fields.sql file
-- This tells Prisma that the migration has been applied

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
  '20250120000000_add_project_archive_fields',  -- Migration name (timestamp_prefix_name)
  NULL,  -- No logs
  NULL,  -- Not rolled back
  NOW(),  -- Started timestamp (same as finished since we're backdating)
  1  -- Applied steps count
WHERE NOT EXISTS (
  SELECT 1 FROM "_prisma_migrations" 
  WHERE "migration_name" = '20250120000000_add_project_archive_fields'
);

-- Verify the migration was recorded:
-- SELECT * FROM "_prisma_migrations" WHERE "migration_name" LIKE '%archive_fields%';



