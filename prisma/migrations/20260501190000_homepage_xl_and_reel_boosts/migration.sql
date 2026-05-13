-- Task 05: Homepage Editorial Elevation Feed
-- Adds:
--   1. ProjectPost columns: homepage_xl_starts_at, homepage_xl_ends_at
--   2. ProjectPost partial index: project_posts_homepage_xl_window_idx
--   3. Enum: HomepageReelBoostStatus (PENDING/ACTIVE/EXPIRED)
--   4. Table: homepage_reel_boosts (vendor auction for first 2 reel slots)
--
-- All DDL is idempotent (IF NOT EXISTS / DO $$ guards) so shadow-DB replay
-- and re-runs succeed cleanly.

-- 1. ProjectPost columns
ALTER TABLE "project_posts" ADD COLUMN IF NOT EXISTS "homepage_xl_starts_at" TIMESTAMP(3);
ALTER TABLE "project_posts" ADD COLUMN IF NOT EXISTS "homepage_xl_ends_at"   TIMESTAMP(3);

-- 2. Partial index (only indexes rows where the window is set — most rows aren't)
CREATE INDEX IF NOT EXISTS "project_posts_homepage_xl_window_idx"
  ON "project_posts" ("homepage_xl_starts_at", "homepage_xl_ends_at")
  WHERE "homepage_xl_starts_at" IS NOT NULL;

-- 3. HomepageReelBoostStatus enum
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'HomepageReelBoostStatus') THEN
        CREATE TYPE "HomepageReelBoostStatus" AS ENUM ('PENDING', 'ACTIVE', 'EXPIRED');
    END IF;
END $$;

-- 4. homepage_reel_boosts table
CREATE TABLE IF NOT EXISTS "homepage_reel_boosts" (
    "id"            TEXT NOT NULL,
    "projectPostId" TEXT NOT NULL,
    "productId"     TEXT NOT NULL,
    "vendorId"      TEXT NOT NULL,
    "bidCents"      INTEGER NOT NULL,
    "status"        "HomepageReelBoostStatus" NOT NULL DEFAULT 'PENDING',
    "startsAt"      TIMESTAMP(3) NOT NULL,
    "endsAt"        TIMESTAMP(3) NOT NULL,
    "slotPosition"  INTEGER,
    "impressions"   INTEGER NOT NULL DEFAULT 0,
    "clicks"        INTEGER NOT NULL DEFAULT 0,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "homepage_reel_boosts_pkey" PRIMARY KEY ("id")
);

-- Unique: one bid per (post, product, vendor) — prevents double-bidding the same slot.
CREATE UNIQUE INDEX IF NOT EXISTS "homepage_reel_boosts_projectPostId_productId_vendorId_key"
  ON "homepage_reel_boosts" ("projectPostId", "productId", "vendorId");

-- Hot read path: "active boosts on this post, ordered by bid desc"
CREATE INDEX IF NOT EXISTS "homepage_reel_boosts_projectPostId_status_bidCents_idx"
  ON "homepage_reel_boosts" ("projectPostId", "status", "bidCents" DESC);

CREATE INDEX IF NOT EXISTS "homepage_reel_boosts_vendorId_status_idx"
  ON "homepage_reel_boosts" ("vendorId", "status");

CREATE INDEX IF NOT EXISTS "homepage_reel_boosts_status_idx"
  ON "homepage_reel_boosts" ("status");

-- Foreign keys (ON DELETE CASCADE because a boost is meaningless without its post/product/vendor)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'homepage_reel_boosts_projectPostId_fkey') THEN
        ALTER TABLE "homepage_reel_boosts"
          ADD CONSTRAINT "homepage_reel_boosts_projectPostId_fkey"
          FOREIGN KEY ("projectPostId") REFERENCES "project_posts"("id")
          ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'homepage_reel_boosts_productId_fkey') THEN
        ALTER TABLE "homepage_reel_boosts"
          ADD CONSTRAINT "homepage_reel_boosts_productId_fkey"
          FOREIGN KEY ("productId") REFERENCES "products"("id")
          ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'homepage_reel_boosts_vendorId_fkey') THEN
        ALTER TABLE "homepage_reel_boosts"
          ADD CONSTRAINT "homepage_reel_boosts_vendorId_fkey"
          FOREIGN KEY ("vendorId") REFERENCES "organizations"("id")
          ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
