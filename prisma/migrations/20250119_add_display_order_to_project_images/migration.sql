-- Add displayOrder column to project_images table
-- This allows custom ordering of images for Instagram carousel export

ALTER TABLE "project_images" ADD COLUMN IF NOT EXISTS "displayOrder" INTEGER;

-- Backfill existing rows: set displayOrder based on createdAt (oldest first = 0, 1, 2...)
-- This ensures existing projects have a sensible default order
WITH ordered_images AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (PARTITION BY "projectId" ORDER BY "createdAt" ASC) - 1 AS new_order
  FROM "project_images"
)
UPDATE "project_images" pi
SET "displayOrder" = oi.new_order
FROM ordered_images oi
WHERE pi.id = oi.id;

-- Create index for efficient ordering queries
CREATE INDEX IF NOT EXISTS "project_images_projectId_displayOrder_idx" ON "project_images"("projectId", "displayOrder");

