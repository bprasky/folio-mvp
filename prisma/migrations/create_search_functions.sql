-- SQL Functions: Helper functions for search operations
-- Description: Database-level functions for search queries and maintenance

-- ============================================================
-- Function: Calculate engagement score
-- ============================================================

CREATE OR REPLACE FUNCTION calculate_engagement_score(
    views INTEGER,
    saves INTEGER,
    shares INTEGER
) RETURNS DOUBLE PRECISION AS $$
BEGIN
    RETURN (views * 0.1 + saves * 2.0 + shares * 3.0);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================
-- Function: Build search text from moment data
-- ============================================================

CREATE OR REPLACE FUNCTION build_search_text(
    project_title TEXT,
    project_description TEXT,
    designer_name TEXT,
    room_name TEXT,
    image_name TEXT,
    tags TEXT[]
) RETURNS TEXT AS $$
BEGIN
    RETURN LOWER(
        COALESCE(project_title, '') || ' ' ||
        COALESCE(project_description, '') || ' ' ||
        COALESCE(designer_name, '') || ' ' ||
        COALESCE(room_name, '') || ' ' ||
        COALESCE(image_name, '') || ' ' ||
        ARRAY_TO_STRING(COALESCE(tags, ARRAY[]::TEXT[]), ' ')
    );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================
-- Function: Get moments by tag (for lens filtering)
-- ============================================================

CREATE OR REPLACE FUNCTION get_moments_by_tag(
    search_tag TEXT,
    scope_is_public BOOLEAN DEFAULT TRUE,
    designer_id_filter TEXT DEFAULT NULL
) RETURNS TABLE (
    moment_id TEXT,
    project_id TEXT,
    designer_id TEXT,
    engagement_score DOUBLE PRECISION
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        mi."projectImageId",
        mi."projectId",
        mi."designerId",
        mi."engagementScore"
    FROM "moment_index" mi
    WHERE 
        (search_tag = ANY(mi."combinedTags") OR mi."searchText" ILIKE '%' || search_tag || '%')
        AND (
            CASE 
                WHEN scope_is_public THEN 
                    mi."isPublic" = TRUE AND mi."publishedAt" IS NOT NULL
                ELSE 
                    (designer_id_filter IS NULL OR mi."designerId" = designer_id_filter)
            END
        )
    ORDER BY mi."engagementScore" DESC, mi."updatedAt" DESC
    LIMIT 100;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================
-- Function: Update moment index for a project image
-- ============================================================

CREATE OR REPLACE FUNCTION update_moment_index(
    p_project_image_id TEXT
) RETURNS VOID AS $$
DECLARE
    v_project_id TEXT;
    v_designer_id TEXT;
    v_designer_name TEXT;
    v_project_title TEXT;
    v_is_public BOOLEAN;
    v_published_at TIMESTAMP(3);
    v_combined_tags TEXT[];
    v_search_text TEXT;
    v_engagement_score DOUBLE PRECISION;
BEGIN
    -- Get project and designer info
    SELECT 
        p."id",
        COALESCE(p."designerId", p."ownerId"),
        COALESCE(u."name", 'Unknown'),
        COALESCE(p."title", 'Untitled Project'),
        p."isPublic",
        p."publishedAt"
    INTO 
        v_project_id,
        v_designer_id,
        v_designer_name,
        v_project_title,
        v_is_public,
        v_published_at
    FROM "project_images" pi
    JOIN "projects" p ON pi."projectId" = p."id"
    LEFT JOIN "users" u ON COALESCE(p."designerId", p."ownerId") = u."id"
    WHERE pi."id" = p_project_image_id;
    
    -- Get combined tags
    SELECT ARRAY(
        SELECT DISTINCT LOWER(UNNEST(ARRAY[
            pr."name",
            pr."category",
            pr."brand"
        ]))
        FROM "product_tags" pt
        JOIN "products" pr ON pt."productId" = pr."id"
        WHERE pt."imageId" = p_project_image_id
        AND pr."name" IS NOT NULL
    ) || COALESCE(
        (SELECT "aiTags" FROM "project_images" WHERE "id" = p_project_image_id),
        ARRAY[]::TEXT[]
    ) INTO v_combined_tags;
    
    -- Build search text
    SELECT build_search_text(
        v_project_title,
        (SELECT "description" FROM "projects" WHERE "id" = v_project_id),
        v_designer_name,
        (SELECT "room" FROM "project_images" WHERE "id" = p_project_image_id),
        (SELECT "name" FROM "project_images" WHERE "id" = p_project_image_id),
        v_combined_tags
    ) INTO v_search_text;
    
    -- Calculate engagement score
    SELECT calculate_engagement_score(
        (SELECT "momentViews" FROM "project_images" WHERE "id" = p_project_image_id),
        (SELECT "momentSaves" FROM "project_images" WHERE "id" = p_project_image_id),
        (SELECT "momentShares" FROM "project_images" WHERE "id" = p_project_image_id)
    ) INTO v_engagement_score;
    
    -- Upsert moment_index
    INSERT INTO "moment_index" (
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
        "updatedAt"
    ) VALUES (
        p_project_image_id,
        v_project_id,
        v_designer_id,
        v_designer_name,
        v_project_title,
        v_is_public,
        v_published_at,
        v_combined_tags,
        v_search_text,
        v_engagement_score,
        CURRENT_TIMESTAMP
    )
    ON CONFLICT ("projectImageId") DO UPDATE SET
        "projectId" = EXCLUDED."projectId",
        "designerId" = EXCLUDED."designerId",
        "designerName" = EXCLUDED."designerName",
        "projectTitle" = EXCLUDED."projectTitle",
        "isPublic" = EXCLUDED."isPublic",
        "publishedAt" = EXCLUDED."publishedAt",
        "combinedTags" = EXCLUDED."combinedTags",
        "searchText" = EXCLUDED."searchText",
        "engagementScore" = EXCLUDED."engagementScore",
        "updatedAt" = CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- Trigger: Auto-update moment_index when project_image changes
-- ============================================================

CREATE OR REPLACE FUNCTION trigger_update_moment_index()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM update_moment_index(NEW."id");
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger (optional - can be enabled/disabled)
-- DROP TRIGGER IF EXISTS trg_update_moment_index ON "project_images";
-- CREATE TRIGGER trg_update_moment_index
--     AFTER INSERT OR UPDATE ON "project_images"
--     FOR EACH ROW
--     EXECUTE FUNCTION trigger_update_moment_index();

-- ============================================================
-- Function: Get trending search terms
-- ============================================================

CREATE OR REPLACE FUNCTION get_trending_terms(
    time_window_hours INTEGER DEFAULT 168 -- 7 days
) RETURNS TABLE (
    term TEXT,
    search_count BIGINT,
    growth_percent DOUBLE PRECISION
) AS $$
DECLARE
    window_start TIMESTAMP;
    baseline_start TIMESTAMP;
BEGIN
    window_start := CURRENT_TIMESTAMP - (time_window_hours || ' hours')::INTERVAL;
    baseline_start := window_start - (time_window_hours || ' hours')::INTERVAL;
    
    RETURN QUERY
    WITH current_period AS (
        SELECT UNNEST("tags") AS tag, COUNT(*) AS cnt
        FROM "context_signals"
        WHERE "action" = 'search'
        AND "createdAt" >= window_start
        GROUP BY tag
    ),
    baseline_period AS (
        SELECT UNNEST("tags") AS tag, COUNT(*) AS cnt
        FROM "context_signals"
        WHERE "action" = 'search'
        AND "createdAt" >= baseline_start
        AND "createdAt" < window_start
        GROUP BY tag
    )
    SELECT 
        cp.tag,
        cp.cnt,
        CASE 
            WHEN bp.cnt > 0 THEN 
                ((cp.cnt::DOUBLE PRECISION - bp.cnt::DOUBLE PRECISION) / bp.cnt::DOUBLE PRECISION) * 100
            ELSE 
                CASE WHEN cp.cnt > 0 THEN 100.0 ELSE 0.0 END
        END AS growth
    FROM current_period cp
    LEFT JOIN baseline_period bp ON cp.tag = bp.tag
    WHERE cp.cnt >= 5 OR (bp.cnt IS NULL AND cp.cnt > 0)
    ORDER BY growth DESC, cp.cnt DESC
    LIMIT 20;
END;
$$ LANGUAGE plpgsql STABLE;

