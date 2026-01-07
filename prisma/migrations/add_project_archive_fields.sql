-- Add archivedAt and deletedAt fields to projects table
-- These fields support the archive/delete workflow where:
-- - archivedAt: timestamp when project was archived
-- - deletedAt: timestamp when project should be permanently deleted (30 days after archive)

ALTER TABLE "projects" 
ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP,
ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP;

-- Add index on archivedAt for efficient queries of archived projects
CREATE INDEX IF NOT EXISTS "projects_archivedAt_idx" ON "projects"("archivedAt");

-- Add index on deletedAt for efficient cleanup queries
CREATE INDEX IF NOT EXISTS "projects_deletedAt_idx" ON "projects"("deletedAt");



