-- Create media table for Media model declared in schema.prisma (lines 2634-2670).
--
-- Authored 2026-04-20 as Phase 5B Bucket 3 item 2.
--
-- Phantom-model fix: schema.prisma declares model Media mapped to 'media' table (lines
-- 2634-2670), no table in prod. 6 code call sites in 4 src/ files (profile page tabs +
-- pin manager) all read operations.
--
-- Two FKs with different onDelete semantics per schema.prisma @relation attributes:
--   - userId → users(id): explicit onDelete:Cascade — media is owned by a designer,
--     deleted with them
--   - projectId → projects(id): implicit onDelete:SetNull (Prisma default for optional
--     relations) — media survives project deletion, just unlinks
--
-- MediaType enum already exists in prod — no CREATE TYPE needed. transcript is TEXT
-- (Prisma @db.Text annotation no-ops in Postgres where TEXT is already unlimited).
-- quotes is JSONB. All DateTime fields use TIMESTAMPTZ per Phase 4 convention. Integer
-- counters (views/saves/shares) default to 0 matching schema.prisma.
--
-- No data migration, no CHECK dropping, no default bracketing — fresh CREATE TABLE.

CREATE TABLE IF NOT EXISTS "media" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "MediaType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "thumbnailUrl" TEXT,
    "sourceUrl" TEXT,
    "hostedUrl" TEXT,
    "duration" INTEGER,
    "transcript" TEXT,
    "quotes" JSONB,
    "projectId" TEXT,
    "views" INTEGER NOT NULL DEFAULT 0,
    "saves" INTEGER NOT NULL DEFAULT 0,
    "shares" INTEGER NOT NULL DEFAULT 0,
    "publishedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "pinnedAt" TIMESTAMPTZ,
    "pinOrder" INTEGER,

    CONSTRAINT "media_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "media_userId_publishedAt_idx" ON "media"("userId", "publishedAt");
CREATE INDEX IF NOT EXISTS "media_userId_type_idx" ON "media"("userId", "type");

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'media_userId_fkey') THEN
        ALTER TABLE "media"
            ADD CONSTRAINT "media_userId_fkey"
            FOREIGN KEY ("userId") REFERENCES "users"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'media_projectId_fkey') THEN
        ALTER TABLE "media"
            ADD CONSTRAINT "media_projectId_fkey"
            FOREIGN KEY ("projectId") REFERENCES "projects"("id")
            ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
