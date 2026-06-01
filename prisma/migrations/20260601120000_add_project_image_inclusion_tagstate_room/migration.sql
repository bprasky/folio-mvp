-- Publish flow (spec 20 §4): add per-photo inclusion + tag-review state and a
-- structured room assignment to project_images. ADD-only, fully idempotent.
--
-- Existing rows back-fill to INCLUDED / UNREVIEWED via column defaults (no data
-- migration needed). roomId is then back-filled from the legacy free-text
-- `room` column by matching Room.name within the same project.

-- 1. Enums (guarded against re-run)
DO $$ BEGIN
  CREATE TYPE "ImageInclusion" AS ENUM ('INCLUDED', 'EXCLUDED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "ImageTagState" AS ENUM ('UNREVIEWED', 'REVIEWED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 2. Columns (defaults back-fill existing rows; nullable roomId)
ALTER TABLE "project_images"
  ADD COLUMN IF NOT EXISTS "inclusion" "ImageInclusion" NOT NULL DEFAULT 'INCLUDED';

ALTER TABLE "project_images"
  ADD COLUMN IF NOT EXISTS "tagState" "ImageTagState" NOT NULL DEFAULT 'UNREVIEWED';

ALTER TABLE "project_images"
  ADD COLUMN IF NOT EXISTS "roomId" TEXT;

-- 3. Foreign key (guarded). SET NULL keeps photos when a room is deleted —
-- they return to Uncategorized rather than disappearing.
DO $$ BEGIN
  ALTER TABLE "project_images"
    ADD CONSTRAINT "project_images_roomId_fkey"
    FOREIGN KEY ("roomId") REFERENCES "rooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 4. Back-fill roomId from the legacy `room` string (idempotent: only fills
-- rows still null). Match is case-insensitive + trimmed, scoped to the project.
UPDATE "project_images" pi
SET "roomId" = r."id"
FROM "rooms" r
WHERE pi."roomId" IS NULL
  AND pi."room" IS NOT NULL
  AND btrim(lower(pi."room")) = btrim(lower(r."name"))
  AND r."projectId" = pi."projectId";
