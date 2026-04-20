-- Living Project System Migration (Additive Only)
-- Promoted from docs/living-project-migration.sql.
-- Already idempotent via IF NOT EXISTS and DO $$ ... guards.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ProjectTimeline') THEN
    CREATE TYPE "ProjectTimeline" AS ENUM ('PAST', 'ACTIVE', 'FUTURE');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SkeletonStatus') THEN
    CREATE TYPE "SkeletonStatus" AS ENUM ('UNCONFIRMED', 'CONFIRMED', 'DISMISSED');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SkeletonCreatedBy') THEN
    CREATE TYPE "SkeletonCreatedBy" AS ENUM ('AI', 'HUMAN');
  END IF;
END $$;

ALTER TABLE "projects"
  ADD COLUMN IF NOT EXISTS "intent" "ProjectTimeline" NOT NULL DEFAULT 'PAST',
  ADD COLUMN IF NOT EXISTS "livingEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "livingOptOut" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "skeleton_items" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "projectImageId" TEXT NOT NULL,
  "roomName" TEXT,
  "bbox" JSONB NOT NULL,
  "label" TEXT NOT NULL,
  "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "status" "SkeletonStatus" NOT NULL DEFAULT 'UNCONFIRMED',
  "createdBy" "SkeletonCreatedBy" NOT NULL DEFAULT 'AI',
  "confirmedProductId" TEXT,
  "confirmedLabel" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "skeleton_items_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'skeleton_items_projectId_fkey') THEN
    ALTER TABLE "skeleton_items"
      ADD CONSTRAINT "skeleton_items_projectId_fkey"
        FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'skeleton_items_projectImageId_fkey') THEN
    ALTER TABLE "skeleton_items"
      ADD CONSTRAINT "skeleton_items_projectImageId_fkey"
        FOREIGN KEY ("projectImageId") REFERENCES "project_images"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'skeleton_items_confirmedProductId_fkey') THEN
    ALTER TABLE "skeleton_items"
      ADD CONSTRAINT "skeleton_items_confirmedProductId_fkey"
        FOREIGN KEY ("confirmedProductId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "skeleton_items_projectId_projectImageId_status_idx"
  ON "skeleton_items"("projectId", "projectImageId", "status");

ALTER TABLE "project_posts"
  ADD COLUMN IF NOT EXISTS "dynamicHeroUpdatedAt" TIMESTAMP(3);
