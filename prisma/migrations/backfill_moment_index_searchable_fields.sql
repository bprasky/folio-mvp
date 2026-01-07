-- Backfill Script: Populate Searchable Fields in MomentIndex
-- Description: Backfills room, vendors, categories, colors, materials, and styles for existing moment_index records
-- Date: 2025-01-XX
--
-- WARNING: This script can take a long time on large datasets.
-- Consider running in batches or using the TypeScript backfill script for progress tracking.
--
-- Usage: Run this AFTER add_searchable_fields_to_moment_index.sql

-- ============================================================
-- 1. Backfill room and roomNormalized from project_images
-- ============================================================

UPDATE "moment_index" mi
SET 
  "room" = CASE 
    WHEN pi."room" IS NOT NULL AND TRIM(pi."room") != '' 
    THEN LOWER(TRIM(pi."room"))
    ELSE NULL
  END,
  "roomNormalized" = CASE 
    WHEN pi."room" IS NOT NULL AND TRIM(pi."room") != '' 
    THEN LOWER(REGEXP_REPLACE(TRIM(pi."room"), '[\s_-]+', '', 'g'))
    ELSE NULL
  END
FROM "project_images" pi
WHERE mi."projectImageId" = pi."id"
  AND (mi."room" IS NULL OR mi."roomNormalized" IS NULL);

-- ============================================================
-- 2. Backfill vendors and vendorIds from product_tags
-- ============================================================

UPDATE "moment_index" mi
SET 
  "vendors" = COALESCE(
    (
      SELECT ARRAY_AGG(DISTINCT LOWER(COALESCE(u."companyName", u."name", '')))
      FROM "product_tags" pt
      JOIN "products" p ON pt."productId" = p."id"
      LEFT JOIN "users" u ON p."vendorId" = u."id"
      WHERE pt."imageId" = mi."projectImageId"
        AND u."id" IS NOT NULL
        AND COALESCE(u."companyName", u."name", '') != ''
    ),
    ARRAY[]::TEXT[]
  ),
  "vendorIds" = COALESCE(
    (
      SELECT ARRAY_AGG(DISTINCT u."id")
      FROM "product_tags" pt
      JOIN "products" p ON pt."productId" = p."id"
      LEFT JOIN "users" u ON p."vendorId" = u."id"
      WHERE pt."imageId" = mi."projectImageId"
        AND u."id" IS NOT NULL
    ),
    ARRAY[]::TEXT[]
  )
WHERE mi."vendors" = ARRAY[]::TEXT[] OR mi."vendorIds" = ARRAY[]::TEXT[];

-- ============================================================
-- 3. Backfill categories from product_tags and products
-- ============================================================

UPDATE "moment_index" mi
SET 
  "categories" = COALESCE(
    (
      SELECT ARRAY_AGG(DISTINCT LOWER(p."category"))
      FROM "product_tags" pt
      JOIN "products" p ON pt."productId" = p."id"
      WHERE pt."imageId" = mi."projectImageId"
        AND p."category" IS NOT NULL
        AND TRIM(p."category") != ''
    ),
    ARRAY[]::TEXT[]
  )
WHERE mi."categories" = ARRAY[]::TEXT[];

-- ============================================================
-- 4. Backfill colors, materials, and styles from aiTags
-- ============================================================
--
-- Note: This extracts from the aiTags array on project_images.
-- The extraction logic matches keywords defined in the TypeScript code.
-- For a more sophisticated extraction, use the TypeScript backfill script.
--

-- Extract colors from aiTags
UPDATE "moment_index" mi
SET 
  "colors" = COALESCE(
    (
      SELECT ARRAY_AGG(DISTINCT tag)
      FROM "project_images" pi,
      LATERAL UNNEST(COALESCE(pi."aiTags", ARRAY[]::TEXT[])) AS tag
      WHERE pi."id" = mi."projectImageId"
        AND LOWER(tag) IN (
          'white', 'black', 'gray', 'grey', 'beige', 'cream', 'ivory', 
          'brown', 'tan', 'oak', 'walnut', 'brass', 'gold', 'silver', 
          'chrome', 'blue', 'green', 'red', 'navy', 'terracotta'
        )
    ),
    ARRAY[]::TEXT[]
  )
WHERE mi."colors" = ARRAY[]::TEXT[];

-- Extract materials from aiTags
UPDATE "moment_index" mi
SET 
  "materials" = COALESCE(
    (
      SELECT ARRAY_AGG(DISTINCT tag)
      FROM "project_images" pi,
      LATERAL UNNEST(COALESCE(pi."aiTags", ARRAY[]::TEXT[])) AS tag
      WHERE pi."id" = mi."projectImageId"
        AND LOWER(tag) IN (
          'wood', 'stone', 'marble', 'granite', 'terrazzo', 'metal', 
          'brass', 'steel', 'glass', 'fabric', 'linen', 'velvet', 
          'leather', 'ceramic', 'tile', 'concrete', 'plaster'
        )
    ),
    ARRAY[]::TEXT[]
  )
WHERE mi."materials" = ARRAY[]::TEXT[];

-- Extract styles from aiTags (if present)
-- Note: Styles are typically not in aiTags, but included for completeness
UPDATE "moment_index" mi
SET 
  "styles" = COALESCE(
    (
      SELECT ARRAY_AGG(DISTINCT tag)
      FROM "project_images" pi,
      LATERAL UNNEST(COALESCE(pi."aiTags", ARRAY[]::TEXT[])) AS tag
      WHERE pi."id" = mi."projectImageId"
        AND LOWER(tag) IN (
          'modern', 'contemporary', 'traditional', 'transitional', 
          'coastal', 'mediterranean', 'minimalist', 'industrial', 
          'rustic', 'bohemian', 'scandinavian', 'mid-century', 
          'art deco', 'farmhouse'
        )
    ),
    ARRAY[]::TEXT[]
  )
WHERE mi."styles" = ARRAY[]::TEXT[];

-- ============================================================
-- 5. Update statistics
-- ============================================================

-- Analyze the table to update statistics for query planner
ANALYZE "moment_index";

-- ============================================================
-- 6. Verification queries (run these to check backfill results)
-- ============================================================

-- Check how many records have room data
-- SELECT COUNT(*) as total, COUNT("room") as with_room FROM "moment_index";

-- Check vendor distribution
-- SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE array_length("vendors", 1) > 0) as with_vendors FROM "moment_index";

-- Check category distribution
-- SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE array_length("categories", 1) > 0) as with_categories FROM "moment_index";

-- Sample records with all fields populated
-- SELECT "id", "room", "vendors", "categories", "colors", "materials", "styles" 
-- FROM "moment_index" 
-- WHERE "room" IS NOT NULL 
--   AND array_length("vendors", 1) > 0
-- LIMIT 10;

