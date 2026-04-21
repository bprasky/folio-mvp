-- Phase 5H2: record existing pending_rep_invites in migration history.
-- Table was created hand-managed prior to reliable migration system.
-- CREATE TABLE IF NOT EXISTS for idempotency — prod is untouched; shadow DB gets the table on replay.
-- Column types lifted from information_schema.columns against prod (2026-04-21).

DO $$ BEGIN
    CREATE TYPE "PendingRepInviteStatus" AS ENUM ('PENDING', 'CLAIMED', 'CANCELLED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "pending_rep_invites" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "vendorOrganizationId" TEXT,
    "designerId" TEXT,
    "projectId" TEXT,
    "projectTagId" TEXT,
    "status" "PendingRepInviteStatus" NOT NULL DEFAULT 'PENDING'::"PendingRepInviteStatus",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "repUserId" TEXT
    ,
    CONSTRAINT "pending_rep_invites_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS pending_rep_invites_email_idx ON public.pending_rep_invites USING btree (email);
CREATE INDEX IF NOT EXISTS pending_rep_invites_status_idx ON public.pending_rep_invites USING btree (status);
CREATE UNIQUE INDEX IF NOT EXISTS pending_rep_invites_token_key ON public.pending_rep_invites USING btree (token);
CREATE INDEX IF NOT EXISTS "pending_rep_invites_vendorOrganizationId_idx" ON public.pending_rep_invites USING btree ("vendorOrganizationId");

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pending_rep_invites_designerId_fkey') THEN
        ALTER TABLE "pending_rep_invites" ADD CONSTRAINT "pending_rep_invites_designerId_fkey" FOREIGN KEY ("designerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pending_rep_invites_projectId_fkey') THEN
        ALTER TABLE "pending_rep_invites" ADD CONSTRAINT "pending_rep_invites_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pending_rep_invites_projectTagId_fkey') THEN
        ALTER TABLE "pending_rep_invites" ADD CONSTRAINT "pending_rep_invites_projectTagId_fkey" FOREIGN KEY ("projectTagId") REFERENCES "product_tags"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pending_rep_invites_repUserId_fkey') THEN
        ALTER TABLE "pending_rep_invites" ADD CONSTRAINT "pending_rep_invites_repUserId_fkey" FOREIGN KEY ("repUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pending_rep_invites_vendorOrganizationId_fkey') THEN
        ALTER TABLE "pending_rep_invites" ADD CONSTRAINT "pending_rep_invites_vendorOrganizationId_fkey" FOREIGN KEY ("vendorOrganizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
