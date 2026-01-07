-- Add displayOrder column to project_images table
-- This allows custom ordering of images for Instagram carousels

-- Add the column (nullable, so existing rows won't break)
ALTER TABLE "project_images" 
ADD COLUMN IF NOT EXISTS "displayOrder" INTEGER;

-- Backfill existing images with a default displayOrder based on creation order
-- This ensures all existing images have an order value
UPDATE "project_images" 
SET "displayOrder" = subquery.row_number
FROM (
  SELECT 
    id, 
    ROW_NUMBER() OVER (PARTITION BY "projectId" ORDER BY "createdAt" ASC) as row_number
  FROM "project_images"
  WHERE "displayOrder" IS NULL
) AS subquery
WHERE "project_images".id = subquery.id;

