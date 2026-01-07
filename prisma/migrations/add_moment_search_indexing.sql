-- Migration: Add Moment Search Indexing
-- Description: Adds search fields to project_images and creates moment_index table
-- Date: 2024

-- ============================================================
-- 1. Add search fields to project_images table
-- ============================================================

-- Add search indexing fields to project_images
ALTER TABLE "project_images" 
ADD COLUMN IF NOT EXISTS "searchVector" TEXT,
ADD COLUMN IF NOT EXISTS "aiTags" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN IF NOT EXISTS "aiColors" JSONB,
ADD COLUMN IF NOT EXISTS "aiMaterials" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN IF NOT EXISTS "aiSpaces" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN IF NOT EXISTS "indexedAt" TIMESTAMP(3);

-- Add engagement fields for ranking
ALTER TABLE "project_images"
ADD COLUMN IF NOT EXISTS "momentViews" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "momentSaves" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "momentShares" INTEGER NOT NULL DEFAULT 0;

-- ============================================================
-- 2. Create moment_index table
-- ============================================================

CREATE TABLE IF NOT EXISTS "moment_index" (
    "id" TEXT NOT NULL,
    "projectImageId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "designerId" TEXT NOT NULL,
    "designerName" TEXT NOT NULL,
    "projectTitle" TEXT NOT NULL,
    "isPublic" BOOLEAN NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "combinedTags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "searchText" TEXT NOT NULL,
    "engagementScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "editorialScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "moment_index_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "moment_index_projectImageId_key" UNIQUE ("projectImageId")
);

-- ============================================================
-- 3. Add foreign key constraint
-- ============================================================

ALTER TABLE "moment_index" 
ADD CONSTRAINT "moment_index_projectImageId_fkey" 
FOREIGN KEY ("projectImageId") 
REFERENCES "project_images"("id") 
ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================
-- 4. Create indexes for performance
-- ============================================================

-- Index for public/published filtering
CREATE INDEX IF NOT EXISTS "moment_index_isPublic_publishedAt_idx" 
ON "moment_index"("isPublic", "publishedAt");

-- Index for designer filtering
CREATE INDEX IF NOT EXISTS "moment_index_designerId_idx" 
ON "moment_index"("designerId");

-- Index for tag searching (GIN index for array contains)
CREATE INDEX IF NOT EXISTS "moment_index_combinedTags_idx" 
ON "moment_index" USING GIN ("combinedTags");

-- Index for full-text search on searchText
CREATE INDEX IF NOT EXISTS "moment_index_searchText_idx" 
ON "moment_index" USING GIN (to_tsvector('english', "searchText"));

-- Index for engagement score sorting
CREATE INDEX IF NOT EXISTS "moment_index_engagementScore_idx" 
ON "moment_index"("engagementScore" DESC);

-- Index for project lookup
CREATE INDEX IF NOT EXISTS "moment_index_projectId_idx" 
ON "moment_index"("projectId");

-- ============================================================
-- 5. Add comment documentation
-- ============================================================

COMMENT ON TABLE "moment_index" IS 'Denormalized search index for fast moment-level queries';
COMMENT ON COLUMN "moment_index"."combinedTags" IS 'Merge of explicit ProductTag data + AI-detected tags';
COMMENT ON COLUMN "moment_index"."searchText" IS 'Concatenated searchable text from project, designer, room, tags';
COMMENT ON COLUMN "moment_index"."engagementScore" IS 'Calculated from momentViews, momentSaves, momentShares';
COMMENT ON COLUMN "moment_index"."editorialScore" IS 'Score from editorial assignments (future)';

COMMENT ON COLUMN "project_images"."aiTags" IS 'AI-detected objects, materials, colors';
COMMENT ON COLUMN "project_images"."aiMaterials" IS 'AI-detected materials (marble, brass, wood, etc.)';
COMMENT ON COLUMN "project_images"."aiSpaces" IS 'AI-detected space types (kitchen, bathroom, pool, etc.)';
COMMENT ON COLUMN "project_images"."momentViews" IS 'Engagement metric for search ranking';
COMMENT ON COLUMN "project_images"."momentSaves" IS 'Engagement metric for search ranking';
COMMENT ON COLUMN "project_images"."momentShares" IS 'Engagement metric for search ranking';

