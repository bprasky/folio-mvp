-- Organization Membership System Migration
-- Phase 2: Adds org status, verification fields, join requests, and invites

-- Add OrgStatus enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'OrgStatus') THEN
        CREATE TYPE "OrgStatus" AS ENUM ('UNCLAIMED', 'CLAIMED', 'PROFESSIONAL');
    END IF;
END $$;

-- Add DESIGNER to OrgType enum
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumlabel = 'DESIGNER'
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'OrgType')
    ) THEN
        ALTER TYPE "OrgType" ADD VALUE 'DESIGNER';
    END IF;
END $$;

-- Add new columns to organizations table
ALTER TABLE "organizations"
ADD COLUMN IF NOT EXISTS "status" "OrgStatus" DEFAULT 'UNCLAIMED',
ADD COLUMN IF NOT EXISTS "address" TEXT,
ADD COLUMN IF NOT EXISTS "phone" TEXT,
ADD COLUMN IF NOT EXISTS "businessLicense" TEXT,
ADD COLUMN IF NOT EXISTS "bankAccount" JSONB,
ADD COLUMN IF NOT EXISTS "verifiedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "verifiedBy" TEXT,
ADD COLUMN IF NOT EXISTS "createdBy" TEXT,
ADD COLUMN IF NOT EXISTS "salesNotes" TEXT,
ADD COLUMN IF NOT EXISTS "salesContactedAt" TIMESTAMP(3);

-- Add indexes to organizations table
CREATE INDEX IF NOT EXISTS "organizations_status_idx" ON "organizations"("status");
CREATE INDEX IF NOT EXISTS "organizations_type_idx" ON "organizations"("type");
CREATE INDEX IF NOT EXISTS "organizations_createdBy_idx" ON "organizations"("createdBy");

-- Add showOnProfile to organization_users
ALTER TABLE "organization_users"
ADD COLUMN IF NOT EXISTS "showOnProfile" BOOLEAN DEFAULT true;

-- Add indexes to organization_users
CREATE INDEX IF NOT EXISTS "organization_users_userId_idx" ON "organization_users"("userId");
CREATE INDEX IF NOT EXISTS "organization_users_organizationId_idx" ON "organization_users"("organizationId");

-- Create JoinRequestStatus enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'JoinRequestStatus') THEN
        CREATE TYPE "JoinRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
    END IF;
END $$;

-- Create org_join_requests table
CREATE TABLE IF NOT EXISTS "org_join_requests" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "status" "JoinRequestStatus" NOT NULL DEFAULT 'PENDING',
    "message" TEXT,
    "rejectionNote" TEXT,
    "reviewedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "org_join_requests_pkey" PRIMARY KEY ("id")
);

-- Add unique constraint and indexes to org_join_requests
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'org_join_requests_userId_organizationId_key'
    ) THEN
        ALTER TABLE "org_join_requests"
        ADD CONSTRAINT "org_join_requests_userId_organizationId_key"
        UNIQUE ("userId", "organizationId");
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS "org_join_requests_organizationId_status_idx" ON "org_join_requests"("organizationId", "status");
CREATE INDEX IF NOT EXISTS "org_join_requests_userId_idx" ON "org_join_requests"("userId");

-- Create InviteStatus enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'InviteStatus') THEN
        CREATE TYPE "InviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED');
    END IF;
END $$;

-- Create org_invites table
CREATE TABLE IF NOT EXISTS "org_invites" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "OrgUserRole" NOT NULL DEFAULT 'MEMBER',
    "status" "InviteStatus" NOT NULL DEFAULT 'PENDING',
    "token" TEXT NOT NULL,
    "invitedBy" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),

    CONSTRAINT "org_invites_pkey" PRIMARY KEY ("id")
);

-- Add unique constraint and indexes to org_invites
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'org_invites_token_key'
    ) THEN
        ALTER TABLE "org_invites"
        ADD CONSTRAINT "org_invites_token_key"
        UNIQUE ("token");
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS "org_invites_organizationId_status_idx" ON "org_invites"("organizationId", "status");
CREATE INDEX IF NOT EXISTS "org_invites_email_idx" ON "org_invites"("email");
CREATE INDEX IF NOT EXISTS "org_invites_token_idx" ON "org_invites"("token");
