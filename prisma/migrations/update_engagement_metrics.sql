-- Update Script: Sync engagement metrics from project to moments
-- Description: Updates momentViews, momentSaves, momentShares from project-level metrics
-- Usage: Run periodically to sync engagement data

-- ============================================================
-- Update moment engagement metrics from project metrics
-- ============================================================

-- Option 1: Distribute project views evenly across images
-- (Simple approach - can be refined with actual tracking)
UPDATE "project_images" pi
SET 
    "momentViews" = GREATEST(
        pi."momentViews",
        FLOOR(p."views"::FLOAT / NULLIF(
            (SELECT COUNT(*) FROM "project_images" pi2 WHERE pi2."projectId" = p."id"), 
            1
        ))
    )
FROM "projects" p
WHERE pi."projectId" = p."id"
AND p."views" > 0;

-- Option 2: Update from actual engagement events (if available)
-- This would query ContextSignal or EngagementEvent tables
-- Example:
/*
UPDATE "project_images" pi
SET 
    "momentViews" = (
        SELECT COUNT(*) 
        FROM "context_signals" cs
        WHERE cs."action" = 'moment_view'
        AND cs."meta"->>'momentId' = pi."id"
    ),
    "momentSaves" = (
        SELECT COUNT(*) 
        FROM "context_signals" cs
        WHERE cs."action" = 'moment_save'
        AND cs."meta"->>'momentId' = pi."id"
    ),
    "momentShares" = (
        SELECT COUNT(*) 
        FROM "context_signals" cs
        WHERE cs."action" = 'moment_share'
        AND cs."meta"->>'momentId' = pi."id"
    );
*/

-- ============================================================
-- Recalculate engagement scores in moment_index
-- ============================================================

UPDATE "moment_index" mi
SET 
    "engagementScore" = (
        pi."momentViews" * 0.1 + 
        pi."momentSaves" * 2.0 + 
        pi."momentShares" * 3.0
    ),
    "updatedAt" = CURRENT_TIMESTAMP
FROM "project_images" pi
WHERE mi."projectImageId" = pi."id";

