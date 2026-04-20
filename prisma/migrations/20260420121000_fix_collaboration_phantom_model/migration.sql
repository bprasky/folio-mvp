-- Create collaboration table for Collaboration model declared in schema.prisma (lines 2725-2758).
--
-- Authored 2026-04-20 as Phase 5B Bucket 3 item 4 — FINAL Phase 5B item.
--
-- Phantom-model fix: schema.prisma declares model Collaboration mapped to 'collaboration'
-- table (lines 2725-2758), no table in prod. 6 code call sites in 4 src/ files (profile
-- page tabs + pin manager) all read operations.
--
-- Most FK-heavy Bucket 3 item: one required FK (userId CASCADE) and three optional FKs
-- (partnerId/vendorId/projectId all SET NULL per Prisma defaults for optional relations
-- without explicit onDelete).
--
-- Named relation note: schema uses partner User? @relation('CollaborationPartner', ...)
-- to disambiguate two FKs targeting users (user owner + partner). The 'CollaborationPartner'
-- name is Prisma-layer only; at SQL level, the only requirement is distinct constraint
-- names — collaboration_userId_fkey vs collaboration_partnerId_fkey satisfies that.
--
-- 16 columns, single composite index @@index([userId, publishedAt]) — fewer indexes than
-- Media/Recognition which each have 2. CollabType enum already exists in prod. TIMESTAMPTZ
-- throughout.

CREATE TABLE IF NOT EXISTS "collaboration" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "CollabType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "partnerId" TEXT,
    "vendorId" TEXT,
    "partnerName" TEXT,
    "partnerLogoUrl" TEXT,
    "projectId" TEXT,
    "imageUrl" TEXT,
    "publishedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "pinnedAt" TIMESTAMPTZ,
    "pinOrder" INTEGER,

    CONSTRAINT "collaboration_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "collaboration_userId_publishedAt_idx" ON "collaboration"("userId", "publishedAt");

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'collaboration_userId_fkey') THEN
        ALTER TABLE "collaboration"
            ADD CONSTRAINT "collaboration_userId_fkey"
            FOREIGN KEY ("userId") REFERENCES "users"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'collaboration_partnerId_fkey') THEN
        ALTER TABLE "collaboration"
            ADD CONSTRAINT "collaboration_partnerId_fkey"
            FOREIGN KEY ("partnerId") REFERENCES "users"("id")
            ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'collaboration_vendorId_fkey') THEN
        ALTER TABLE "collaboration"
            ADD CONSTRAINT "collaboration_vendorId_fkey"
            FOREIGN KEY ("vendorId") REFERENCES "organizations"("id")
            ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'collaboration_projectId_fkey') THEN
        ALTER TABLE "collaboration"
            ADD CONSTRAINT "collaboration_projectId_fkey"
            FOREIGN KEY ("projectId") REFERENCES "projects"("id")
            ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
