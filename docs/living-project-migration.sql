-- Living Project System Migration (Additive Only)
-- Run this SQL directly in your Supabase database
-- All changes are additive and backwards-compatible

-- Step 1: Create new enums (only if they don't exist)
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

-- Step 2: Add new fields to projects table
ALTER TABLE "projects" 
  ADD COLUMN IF NOT EXISTS "intent" "ProjectTimeline" NOT NULL DEFAULT 'PAST',
  ADD COLUMN IF NOT EXISTS "livingEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "livingOptOut" BOOLEAN NOT NULL DEFAULT false;

-- Step 3: Create skeleton_items table
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

-- Step 4: Add foreign key constraints for skeleton_items (only if they don't exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'skeleton_items_projectId_fkey'
  ) THEN
    ALTER TABLE "skeleton_items" 
      ADD CONSTRAINT "skeleton_items_projectId_fkey" 
        FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'skeleton_items_projectImageId_fkey'
  ) THEN
    ALTER TABLE "skeleton_items" 
      ADD CONSTRAINT "skeleton_items_projectImageId_fkey" 
        FOREIGN KEY ("projectImageId") REFERENCES "project_images"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'skeleton_items_confirmedProductId_fkey'
  ) THEN
    ALTER TABLE "skeleton_items" 
      ADD CONSTRAINT "skeleton_items_confirmedProductId_fkey" 
        FOREIGN KEY ("confirmedProductId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Step 5: Add indexes for skeleton_items
CREATE INDEX IF NOT EXISTS "skeleton_items_projectId_projectImageId_status_idx" 
  ON "skeleton_items"("projectId", "projectImageId", "status");

-- Step 6: Add dynamicHeroUpdatedAt to project_posts table
ALTER TABLE "project_posts" 
  ADD COLUMN IF NOT EXISTS "dynamicHeroUpdatedAt" TIMESTAMP(3);

-- Verification queries (optional - run to verify):
-- SELECT column_name, data_type, column_default 
-- FROM information_schema.columns 
-- WHERE table_name = 'projects' AND column_name IN ('intent', 'livingEnabled', 'livingOptOut');
-- 
-- SELECT column_name, data_type 
-- FROM information_schema.columns 
-- WHERE table_name = 'skeleton_items';
-- 
-- SELECT column_name, data_type 
-- FROM information_schema.columns 
-- WHERE table_name = 'project_posts' AND column_name = 'dynamicHeroUpdatedAt';

