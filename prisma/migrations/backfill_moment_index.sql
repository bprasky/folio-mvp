-- Backfill Script: Populate moment_index from existing project_images
-- Description: Initial indexing of all existing images
-- Usage: Run after add_moment_search_indexing.sql migration
-- Note: This is a one-time backfill. New images should be indexed via indexMoment() function

-- ============================================================
-- Backfill moment_index from existing project_images
-- ============================================================

INSERT INTO "moment_index" (
    "id",
    "projectImageId",
    "projectId",
    "designerId",
    "designerName",
    "projectTitle",
    "isPublic",
    "publishedAt",
    "combinedTags",
    "searchText",
    "engagementScore",
    "editorialScore",
    "createdAt",
    "updatedAt"
)
SELECT 
    gen_random_uuid()::TEXT AS "id",
    pi."id" AS "projectImageId",
    p."id" AS "projectId",
    COALESCE(p."designerId", p."ownerId") AS "designerId",
    COALESCE(u."name", 'Unknown') AS "designerName",
    COALESCE(p."title", 'Untitled Project') AS "projectTitle",
    p."isPublic" AS "isPublic",
    p."publishedAt" AS "publishedAt",
    -- Combine explicit tags from ProductTag
    ARRAY(
        SELECT DISTINCT LOWER(UNNEST(ARRAY[
            pr."name",
            pr."category",
            pr."brand"
        ]))
        FROM "product_tags" pt
        JOIN "products" pr ON pt."productId" = pr."id"
        WHERE pt."imageId" = pi."id"
        AND pr."name" IS NOT NULL
    ) || COALESCE(pi."aiTags", ARRAY[]::TEXT[]) AS "combinedTags",
    -- Build search text
    LOWER(
        COALESCE(p."title", '') || ' ' ||
        COALESCE(p."description", '') || ' ' ||
        COALESCE(u."name", '') || ' ' ||
        COALESCE(pi."room", '') || ' ' ||
        COALESCE(pi."name", '')
    ) AS "searchText",
    -- Calculate engagement score: views*0.1 + saves*2.0 + shares*3.0
    (pi."momentViews" * 0.1 + pi."momentSaves" * 2.0 + pi."momentShares" * 3.0) AS "engagementScore",
    0.0 AS "editorialScore",
    pi."createdAt" AS "createdAt",
    CURRENT_TIMESTAMP AS "updatedAt"
FROM "project_images" pi
JOIN "projects" p ON pi."projectId" = p."id"
LEFT JOIN "users" u ON COALESCE(p."designerId", p."ownerId") = u."id"
WHERE NOT EXISTS (
    SELECT 1 FROM "moment_index" mi 
    WHERE mi."projectImageId" = pi."id"
)
ON CONFLICT ("projectImageId") DO NOTHING;

-- ============================================================
-- Update statistics
-- ============================================================

ANALYZE "moment_index";
ANALYZE "project_images";

-- ============================================================
-- Report backfill results
-- ============================================================

DO $$
DECLARE
    total_images INTEGER;
    indexed_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO total_images FROM "project_images";
    SELECT COUNT(*) INTO indexed_count FROM "moment_index";
    
    RAISE NOTICE 'Backfill complete: % images indexed out of % total images', indexed_count, total_images;
END $$;

