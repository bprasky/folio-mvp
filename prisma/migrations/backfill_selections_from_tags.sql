-- Retroactive Backfill: Create Selections from existing ProductTags
-- This script processes all existing ProductTags and creates corresponding Selections in Room boards
-- Run this AFTER adding the productTagId field to the selections table

-- Step 1: Add productTagId column to selections table (if not exists)
ALTER TABLE "selections" 
  ADD COLUMN IF NOT EXISTS "productTagId" TEXT;

-- Step 2: Add unique constraint on productTagId (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'selections_productTagId_key'
  ) THEN
    ALTER TABLE "selections" 
      ADD CONSTRAINT "selections_productTagId_key" UNIQUE ("productTagId");
  END IF;
END $$;

-- Step 3: Add foreign key constraint (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'selections_productTagId_fkey'
  ) THEN
    ALTER TABLE "selections" 
      ADD CONSTRAINT "selections_productTagId_fkey" 
        FOREIGN KEY ("productTagId") REFERENCES "product_tags"("id") 
        ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Step 4: Ensure rooms exist for all projects with tagged images
-- Create rooms based on image.room values
INSERT INTO rooms (id, name, "projectId", "createdAt", "updatedAt")
SELECT DISTINCT
  gen_random_uuid() AS id,
  pi.room AS name,
  pi."projectId",
  NOW() AS "createdAt",
  NOW() AS "updatedAt"
FROM project_images pi
INNER JOIN product_tags pt ON pt."imageId" = pi.id
WHERE pi.room IS NOT NULL 
  AND pi.room != ''
  AND NOT EXISTS (
    SELECT 1 FROM rooms r 
    WHERE r."projectId" = pi."projectId" 
      AND r.name = pi.room
  )
ON CONFLICT DO NOTHING;

-- Step 5: Backfill Selections from ProductTags (with room names)
INSERT INTO selections (
  id,
  "productName",
  "vendorName",
  photo,
  "productUrl",
  "unitPrice",
  "projectId",
  "roomId",
  "productTagId",
  source,
  "createdAt",
  "updatedAt",
  "timestamp"
)
SELECT 
  gen_random_uuid() AS id,
  p.name AS "productName",
  p.brand AS "vendorName",
  p."imageUrl" AS photo,
  p.url AS "productUrl",
  p.price AS "unitPrice",
  pi."projectId",
  r.id AS "roomId",
  pt.id AS "productTagId",
  'tag' AS source,
  NOW() AS "createdAt",
  NOW() AS "updatedAt",
  NOW() AS "timestamp"
FROM product_tags pt
INNER JOIN project_images pi ON pt."imageId" = pi.id
INNER JOIN products p ON pt."productId" = p.id
INNER JOIN rooms r ON r."projectId" = pi."projectId" AND r.name = pi.room
WHERE pi.room IS NOT NULL 
  AND pi.room != ''
  -- Only process tags that don't already have a selection
  AND NOT EXISTS (
    SELECT 1 FROM selections s 
    WHERE s."productTagId" = pt.id
  )
ON CONFLICT ("productTagId") DO NOTHING;

-- Step 6: Ensure default rooms exist for projects with tags but no room assignment
INSERT INTO rooms (id, name, "projectId", "createdAt", "updatedAt")
SELECT DISTINCT
  gen_random_uuid() AS id,
  'Unsorted' AS name,
  pi."projectId",
  NOW() AS "createdAt",
  NOW() AS "updatedAt"
FROM project_images pi
INNER JOIN product_tags pt ON pt."imageId" = pi.id
WHERE (pi.room IS NULL OR pi.room = '')
  AND NOT EXISTS (
    SELECT 1 FROM rooms r 
    WHERE r."projectId" = pi."projectId" 
      AND (r.name = 'Unsorted' OR r.name = 'General')
  )
ON CONFLICT DO NOTHING;

-- Step 7: Handle tags where image.room is NULL or empty
-- Create selections in default "Unsorted" room
INSERT INTO selections (
  id,
  "productName",
  "vendorName",
  photo,
  "productUrl",
  "unitPrice",
  "projectId",
  "roomId",
  "productTagId",
  source,
  "createdAt",
  "updatedAt",
  "timestamp"
)
SELECT 
  gen_random_uuid() AS id,
  p.name AS "productName",
  p.brand AS "vendorName",
  p."imageUrl" AS photo,
  p.url AS "productUrl",
  p.price AS "unitPrice",
  pi."projectId",
  r.id AS "roomId",
  pt.id AS "productTagId",
  'tag' AS source,
  NOW() AS "createdAt",
  NOW() AS "updatedAt",
  NOW() AS "timestamp"
FROM product_tags pt
INNER JOIN project_images pi ON pt."imageId" = pi.id
INNER JOIN products p ON pt."productId" = p.id
INNER JOIN rooms r ON r."projectId" = pi."projectId" 
  AND (r.name = 'Unsorted' OR r.name = 'General')
WHERE (pi.room IS NULL OR pi.room = '')
  -- Only process tags that don't already have a selection
  AND NOT EXISTS (
    SELECT 1 FROM selections s 
    WHERE s."productTagId" = pt.id
  )
ON CONFLICT ("productTagId") DO NOTHING;

-- Verification queries:
-- Count how many selections were created from tags
-- SELECT COUNT(*) FROM selections WHERE source = 'tag';

-- Check which projects got backfilled
-- SELECT DISTINCT s."projectId", COUNT(*) as selection_count
-- FROM selections s
-- WHERE s.source = 'tag'
-- GROUP BY s."projectId";

-- Check for any tags that still don't have selections (should be 0 after backfill)
-- SELECT pt.id, pt."productId", pi."projectId", pi.room
-- FROM product_tags pt
-- INNER JOIN project_images pi ON pt."imageId" = pi.id
-- WHERE NOT EXISTS (
--   SELECT 1 FROM selections s WHERE s."productTagId" = pt.id
-- );

