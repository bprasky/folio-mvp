-- Project deletion requests: a member without `delete_projects` can ask an
-- org Owner/Admin to delete a project. Idempotent so it is safe to (re)apply
-- against an environment where parts may already exist.

-- Enum (guarded — CREATE TYPE has no IF NOT EXISTS)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ProjectDeletionRequestStatus') THEN
    CREATE TYPE "ProjectDeletionRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'DECLINED');
  END IF;
END $$;

-- Table
CREATE TABLE IF NOT EXISTS "project_deletion_requests" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "requestedById" TEXT NOT NULL,
  "orgId" TEXT,
  "status" "ProjectDeletionRequestStatus" NOT NULL DEFAULT 'PENDING',
  "reason" TEXT,
  "resolvedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),

  CONSTRAINT "project_deletion_requests_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX IF NOT EXISTS "project_deletion_requests_orgId_status_idx"
  ON "project_deletion_requests"("orgId", "status");
CREATE INDEX IF NOT EXISTS "project_deletion_requests_projectId_status_idx"
  ON "project_deletion_requests"("projectId", "status");
CREATE INDEX IF NOT EXISTS "project_deletion_requests_requestedById_status_idx"
  ON "project_deletion_requests"("requestedById", "status");

-- Foreign keys (conname existence guards)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'project_deletion_requests_projectId_fkey') THEN
    ALTER TABLE "project_deletion_requests"
      ADD CONSTRAINT "project_deletion_requests_projectId_fkey"
      FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'project_deletion_requests_requestedById_fkey') THEN
    ALTER TABLE "project_deletion_requests"
      ADD CONSTRAINT "project_deletion_requests_requestedById_fkey"
      FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'project_deletion_requests_resolvedById_fkey') THEN
    ALTER TABLE "project_deletion_requests"
      ADD CONSTRAINT "project_deletion_requests_resolvedById_fkey"
      FOREIGN KEY ("resolvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
