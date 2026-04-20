-- VendorInviteCandidate + VendorInviteSignal models

DO $$ BEGIN
    CREATE TYPE "VendorInviteCandidateStatus" AS ENUM ('PENDING', 'READY', 'INVITED', 'ARCHIVED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "vendor_invite_candidates" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "vendorName" TEXT NOT NULL,
    "vendorWebsite" TEXT,
    "repEmail" TEXT,
    "repName" TEXT,
    "status" "VendorInviteCandidateStatus" NOT NULL DEFAULT 'PENDING',
    "normalizedKey" TEXT NOT NULL,
    "firstSeenByDesignerId" TEXT,
    "firstSeenInProjectId" TEXT,

    CONSTRAINT "vendor_invite_candidates_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "vendor_invite_signals" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "candidateId" TEXT NOT NULL,
    "designerId" TEXT NOT NULL,
    "projectId" TEXT,
    "tagId" TEXT,

    CONSTRAINT "vendor_invite_signals_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "vendor_invite_candidates_normalizedKey_key" ON "vendor_invite_candidates"("normalizedKey");
CREATE INDEX IF NOT EXISTS "vendor_invite_candidates_status_idx" ON "vendor_invite_candidates"("status");
CREATE INDEX IF NOT EXISTS "vendor_invite_candidates_normalizedKey_idx" ON "vendor_invite_candidates"("normalizedKey");
CREATE INDEX IF NOT EXISTS "vendor_invite_candidates_firstSeenByDesignerId_idx" ON "vendor_invite_candidates"("firstSeenByDesignerId");
CREATE INDEX IF NOT EXISTS "vendor_invite_candidates_createdAt_idx" ON "vendor_invite_candidates"("createdAt");

CREATE INDEX IF NOT EXISTS "vendor_invite_signals_candidateId_idx" ON "vendor_invite_signals"("candidateId");
CREATE INDEX IF NOT EXISTS "vendor_invite_signals_designerId_idx" ON "vendor_invite_signals"("designerId");
CREATE INDEX IF NOT EXISTS "vendor_invite_signals_projectId_idx" ON "vendor_invite_signals"("projectId");
CREATE INDEX IF NOT EXISTS "vendor_invite_signals_createdAt_idx" ON "vendor_invite_signals"("createdAt");

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vendor_invite_candidates_firstSeenByDesignerId_fkey') THEN
        ALTER TABLE "vendor_invite_candidates" ADD CONSTRAINT "vendor_invite_candidates_firstSeenByDesignerId_fkey" FOREIGN KEY ("firstSeenByDesignerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vendor_invite_candidates_firstSeenInProjectId_fkey') THEN
        ALTER TABLE "vendor_invite_candidates" ADD CONSTRAINT "vendor_invite_candidates_firstSeenInProjectId_fkey" FOREIGN KEY ("firstSeenInProjectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vendor_invite_signals_candidateId_fkey') THEN
        ALTER TABLE "vendor_invite_signals" ADD CONSTRAINT "vendor_invite_signals_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "vendor_invite_candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vendor_invite_signals_designerId_fkey') THEN
        ALTER TABLE "vendor_invite_signals" ADD CONSTRAINT "vendor_invite_signals_designerId_fkey" FOREIGN KEY ("designerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vendor_invite_signals_projectId_fkey') THEN
        ALTER TABLE "vendor_invite_signals" ADD CONSTRAINT "vendor_invite_signals_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
