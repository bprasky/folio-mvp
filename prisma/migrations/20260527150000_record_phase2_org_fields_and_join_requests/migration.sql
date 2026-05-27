-- Record Phase 2 organization schema (status, verification, OrgJoinRequest) as
-- a proper timestamped migration. Previously this SQL lived only at
-- prisma/migrations/add_org_phase2_fields.sql (loose root file) which
-- `prisma migrate deploy` doesn't execute, so prod environments never got
-- the org_join_requests table or the new Organization columns. Symptom:
-- POST /api/orgs/[orgId]/join → P2021 "The table public.org_join_requests
-- does not exist in the current database."
--
-- Fully idempotent: every DDL is guarded (IF NOT EXISTS / DO $$ EXCEPTION /
-- DROP CONSTRAINT IF EXISTS ... ADD CONSTRAINT). Re-running against any
-- environment that already had the loose file applied is a no-op.
--
-- Mirrors prisma/migrations/add_org_phase2_fields.sql one-for-one. That
-- loose file is deleted in this PR; phase5e-baseline.json is decremented
-- 33 → 32 to capture the debt payoff.

-- Step 1: OrgStatus enum
DO $$ BEGIN
  CREATE TYPE "OrgStatus" AS ENUM ('UNCLAIMED', 'CLAIMED', 'PROFESSIONAL');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Step 2: OrgJoinRequestStatus enum
DO $$ BEGIN
  CREATE TYPE "OrgJoinRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Step 3: Organization columns
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "status" "OrgStatus" NOT NULL DEFAULT 'UNCLAIMED';
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "address" TEXT;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "phone" TEXT;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "businessLicense" TEXT;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "bankAccountInfo" JSONB;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "verifiedAt" TIMESTAMP(3);
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "verifiedBy" TEXT;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "createdById" TEXT;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "salesNotes" TEXT;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "salesContactedAt" TIMESTAMP(3);

-- Step 4: OrganizationUser column
ALTER TABLE "organization_users" ADD COLUMN IF NOT EXISTS "showOnProfile" BOOLEAN NOT NULL DEFAULT true;

-- Step 5: org_join_requests table
CREATE TABLE IF NOT EXISTS "org_join_requests" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "status" "OrgJoinRequestStatus" NOT NULL DEFAULT 'PENDING',
  "message" TEXT,
  "reviewedBy" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "org_join_requests_pkey" PRIMARY KEY ("id")
);

-- Step 6: Constraints + indexes (drop-then-add for unique; IF NOT EXISTS for indexes)
ALTER TABLE "org_join_requests" DROP CONSTRAINT IF EXISTS "org_join_requests_userId_organizationId_key";
ALTER TABLE "org_join_requests" ADD CONSTRAINT "org_join_requests_userId_organizationId_key" UNIQUE ("userId", "organizationId");

CREATE INDEX IF NOT EXISTS "org_join_requests_organizationId_status_idx" ON "org_join_requests"("organizationId", "status");
CREATE INDEX IF NOT EXISTS "organizations_status_idx" ON "organizations"("status");
CREATE INDEX IF NOT EXISTS "organizations_type_idx" ON "organizations"("type");
CREATE INDEX IF NOT EXISTS "organizations_createdById_idx" ON "organizations"("createdById");
CREATE INDEX IF NOT EXISTS "organization_users_userId_idx" ON "organization_users"("userId");
CREATE INDEX IF NOT EXISTS "organization_users_organizationId_idx" ON "organization_users"("organizationId");

-- Step 7: Foreign keys (drop-then-add so it's safe to re-run)
ALTER TABLE "org_join_requests" DROP CONSTRAINT IF EXISTS "org_join_requests_userId_fkey";
ALTER TABLE "org_join_requests" ADD CONSTRAINT "org_join_requests_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "org_join_requests" DROP CONSTRAINT IF EXISTS "org_join_requests_organizationId_fkey";
ALTER TABLE "org_join_requests" ADD CONSTRAINT "org_join_requests_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
