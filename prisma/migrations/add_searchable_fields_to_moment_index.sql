-- Migration: Add Searchable Fields to MomentIndex
-- Description: Adds dedicated, indexed columns for room, vendor, category, color, material, and style filtering
-- Date: 2025-01-XX
--
-- This migration enables multi-field search by adding dedicated columns to the moment_index table
-- instead of burying all metadata in a single searchText field. This allows for:
-- - Targeted filtering via UI pills (room type, vendor, etc.)
-- - Better query performance with dedicated indexes
-- - Normalized room matching (handles "living_rooms" vs "living room")

-- ============================================================
-- 1. Add new searchable columns to moment_index
-- ============================================================

ALTER TABLE "moment_index" 
ADD COLUMN IF NOT EXISTS "room" TEXT,
ADD COLUMN IF NOT EXISTS "roomNormalized" TEXT,
ADD COLUMN IF NOT EXISTS "vendors" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN IF NOT EXISTS "vendorIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN IF NOT EXISTS "categories" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN IF NOT EXISTS "colors" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN IF NOT EXISTS "materials" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN IF NOT EXISTS "styles" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN IF NOT EXISTS "mood" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN IF NOT EXISTS "elements" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- ============================================================
-- 2. Create indexes for performance
-- ============================================================

-- Index for room filtering (exact match and contains)
CREATE INDEX IF NOT EXISTS "moment_index_room_idx" 
ON "moment_index"("room");

-- Index for normalized room matching (handles "living_rooms" → "livingroom")
CREATE INDEX IF NOT EXISTS "moment_index_roomNormalized_idx" 
ON "moment_index"("roomNormalized");

-- GIN indexes for array fields (enables fast array contains queries)
-- These indexes support queries like: WHERE vendors @> ARRAY['vendor_name']
CREATE INDEX IF NOT EXISTS "moment_index_vendors_idx" 
ON "moment_index" USING GIN ("vendors");

CREATE INDEX IF NOT EXISTS "moment_index_vendorIds_idx" 
ON "moment_index" USING GIN ("vendorIds");

CREATE INDEX IF NOT EXISTS "moment_index_categories_idx" 
ON "moment_index" USING GIN ("categories");

CREATE INDEX IF NOT EXISTS "moment_index_colors_idx" 
ON "moment_index" USING GIN ("colors");

CREATE INDEX IF NOT EXISTS "moment_index_materials_idx" 
ON "moment_index" USING GIN ("materials");

CREATE INDEX IF NOT EXISTS "moment_index_styles_idx"
ON "moment_index" USING GIN ("styles");

CREATE INDEX IF NOT EXISTS "moment_index_mood_idx"
ON "moment_index" USING GIN ("mood");

CREATE INDEX IF NOT EXISTS "moment_index_elements_idx"
ON "moment_index" USING GIN ("elements");

-- Composite index for common filter combinations (room + vendor)
CREATE INDEX IF NOT EXISTS "moment_index_room_vendors_idx" 
ON "moment_index"("room", "vendors");

-- ============================================================
-- 3. Add column comments for documentation
-- ============================================================

COMMENT ON COLUMN "moment_index"."room" IS 'Room name in lowercase (e.g., "living room", "kitchen", "bathroom")';
COMMENT ON COLUMN "moment_index"."roomNormalized" IS 'Room name normalized: lowercase, no spaces/underscores/hyphens (e.g., "livingroom") for fuzzy matching';
COMMENT ON COLUMN "moment_index"."vendors" IS 'Array of vendor names (lowercase) from tagged products';
COMMENT ON COLUMN "moment_index"."vendorIds" IS 'Array of vendor user IDs for exact filtering';
COMMENT ON COLUMN "moment_index"."categories" IS 'Array of product categories (e.g., ["furniture", "lighting", "textiles"])';
COMMENT ON COLUMN "moment_index"."colors" IS 'Array of detected colors (e.g., ["white", "oak", "brass", "marble"])';
COMMENT ON COLUMN "moment_index"."materials" IS 'Array of detected materials (e.g., ["wood", "stone", "metal", "fabric"])';
COMMENT ON COLUMN "moment_index"."styles" IS 'Array of detected styles (e.g., ["modern", "coastal", "mediterranean"])';
COMMENT ON COLUMN "moment_index"."mood" IS 'Array of detected moods (e.g., ["airy", "moody", "warm", "dramatic"])';
COMMENT ON COLUMN "moment_index"."elements" IS 'Array of detected design elements (e.g., ["pendant lighting", "kitchen island", "built-ins"])';

-- ============================================================
-- 4. Backfill existing records (optional - can be run separately)
-- ============================================================
--
-- Note: This is a placeholder for the backfill logic.
-- The actual backfill should be done via a separate script (backfill-moment-index-fields.ts)
-- to avoid long-running transactions and allow for progress tracking.
--
-- Example backfill query (for reference):
--
-- UPDATE "moment_index" mi
-- SET 
--   "room" = LOWER(TRIM(pi."room")),
--   "roomNormalized" = LOWER(REGEXP_REPLACE(TRIM(pi."room"), '[\s_-]+', '', 'g')),
--   "vendors" = (
--     SELECT ARRAY_AGG(DISTINCT LOWER(COALESCE(u."companyName", u."name", '')))
--     FROM "product_tags" pt
--     JOIN "products" p ON pt."productId" = p."id"
--     JOIN "users" u ON p."vendorId" = u."id"
--     WHERE pt."imageId" = mi."projectImageId"
--       AND u."id" IS NOT NULL
--       AND COALESCE(u."companyName", u."name", '') != ''
--   ),
--   "vendorIds" = (
--     SELECT ARRAY_AGG(DISTINCT u."id")
--     FROM "product_tags" pt
--     JOIN "products" p ON pt."productId" = p."id"
--     JOIN "users" u ON p."vendorId" = u."id"
--     WHERE pt."imageId" = mi."projectImageId"
--       AND u."id" IS NOT NULL
--   )
-- FROM "project_images" pi
-- WHERE mi."projectImageId" = pi."id";

