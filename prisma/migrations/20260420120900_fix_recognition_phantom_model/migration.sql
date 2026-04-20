-- Create recognition table for Recognition model declared in schema.prisma (lines 2682-2712).
--
-- Authored 2026-04-20 as Phase 5B Bucket 3 item 3.
--
-- Phantom-model fix: schema.prisma declares model Recognition mapped to 'recognition'
-- table (lines 2682-2712), no table in prod. 6 code call sites in 4 src/ files (profile
-- page tabs + pin manager) all read operations.
--
-- Structurally a subset of Media (5B.9): same profile-surface skeleton with FK patterns
-- identical — userId CASCADE, projectId SET NULL per Prisma defaults. 16 columns vs
-- Media's 20 — no engagement counters, no JSONB quotes, no transcript, no duration.
--
-- RecognitionType enum already exists in prod with 7 values (extended by Phase 4 Deploy
-- #1 to add PUBLICATION and OTHER). TIMESTAMPTZ for all DateTime fields per Phase 4
-- convention. Note: date column is required non-nullable without a default — callers
-- must supply, matching the InstagramCampaign.expiresAt pattern.

CREATE TABLE IF NOT EXISTS "recognition" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "RecognitionType" NOT NULL,
    "title" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sourceLogoUrl" TEXT,
    "date" TIMESTAMPTZ NOT NULL,
    "url" TEXT,
    "projectId" TEXT,
    "imageUrl" TEXT,
    "excerpt" TEXT,
    "publishedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "pinnedAt" TIMESTAMPTZ,
    "pinOrder" INTEGER,

    CONSTRAINT "recognition_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "recognition_userId_publishedAt_idx" ON "recognition"("userId", "publishedAt");
CREATE INDEX IF NOT EXISTS "recognition_userId_type_idx" ON "recognition"("userId", "type");

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'recognition_userId_fkey') THEN
        ALTER TABLE "recognition"
            ADD CONSTRAINT "recognition_userId_fkey"
            FOREIGN KEY ("userId") REFERENCES "users"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'recognition_projectId_fkey') THEN
        ALTER TABLE "recognition"
            ADD CONSTRAINT "recognition_projectId_fkey"
            FOREIGN KEY ("projectId") REFERENCES "projects"("id")
            ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
