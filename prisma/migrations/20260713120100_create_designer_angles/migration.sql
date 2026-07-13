-- Editorial Queue (docs/17_EDITORIAL_QUEUE.md), migration 2 of 3.
-- Create designer_angles: extracted editorial angles over a designer's corpus.
-- Angles are written by the angle-extraction call after validation against the
-- computed signal digest (every angle must cite at least one signal ID), so
-- evidence always resolves to verifiable rows.
--
-- Idempotent: IF NOT EXISTS on the table and index, column converge guards for
-- partial prior versions, so re-running is a no-op. Column names are camelCase
-- (the model uses @@map for the table name only, no per-field @map), types
-- match the schema. designerId/organizationId are plain strings per the spec's
-- ADD-only schema — no FK to users/organizations.
CREATE TABLE IF NOT EXISTS "designer_angles" (
    "id" TEXT NOT NULL,
    "designerId" TEXT NOT NULL,
    "organizationId" TEXT,
    "angleType" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "signalIds" TEXT[],
    "evidence" JSONB NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "isFresh" BOOLEAN NOT NULL DEFAULT true,
    "extractedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "designer_angles_pkey" PRIMARY KEY ("id")
);

-- Converge the table if a partial version already existed.
ALTER TABLE "designer_angles" ADD COLUMN IF NOT EXISTS "designerId" TEXT;
ALTER TABLE "designer_angles" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
ALTER TABLE "designer_angles" ADD COLUMN IF NOT EXISTS "angleType" TEXT;
ALTER TABLE "designer_angles" ADD COLUMN IF NOT EXISTS "summary" TEXT;
ALTER TABLE "designer_angles" ADD COLUMN IF NOT EXISTS "signalIds" TEXT[];
ALTER TABLE "designer_angles" ADD COLUMN IF NOT EXISTS "evidence" JSONB;
ALTER TABLE "designer_angles" ADD COLUMN IF NOT EXISTS "confidence" DOUBLE PRECISION;
ALTER TABLE "designer_angles" ADD COLUMN IF NOT EXISTS "isFresh" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "designer_angles" ADD COLUMN IF NOT EXISTS "extractedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "designer_angles" ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3);

-- @@index([designerId, isFresh]): the queue reads fresh angles per designer.
CREATE INDEX IF NOT EXISTS "designer_angles_designerId_isFresh_idx"
    ON "designer_angles"("designerId", "isFresh");
