-- =====================================================
-- Design Journey Tracking
-- Tracks the evolution from presentation → final design
-- Run this SQL directly in your database
-- =====================================================

-- 1. Presentation Products
-- Products extracted from original presentations (PDFs, slides, etc.)
CREATE TABLE IF NOT EXISTS presentation_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Link to project (presentations become projects)
    project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,

    -- Product identification
    cached_product_id UUID REFERENCES cached_products(id) ON DELETE SET NULL,

    -- Extracted data (before matching to cache)
    extracted_name TEXT,
    extracted_brand TEXT,
    extracted_image_url TEXT,
    extracted_url TEXT, -- if a URL was found
    extracted_price DECIMAL(10,2),

    -- Role/placement
    suggested_role TEXT, -- countertop, backsplash, lighting, etc.
    suggested_room TEXT, -- kitchen, master bath, etc.

    -- Source context
    slide_number INT,
    page_number INT,
    source_file_url TEXT,
    source_type TEXT, -- 'pdf', 'pptx', 'figma', 'image', 'url_list'

    -- Matching status
    match_status TEXT DEFAULT 'unmatched', -- 'unmatched', 'matched', 'manual', 'no_match'
    match_confidence DECIMAL(3,2),

    -- Was this product kept in final design?
    kept_in_final BOOLEAN,
    final_selection_id TEXT REFERENCES selections(id) ON DELETE SET NULL,

    extracted_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_presentation_products_project ON presentation_products(project_id);
CREATE INDEX IF NOT EXISTS idx_presentation_products_cached ON presentation_products(cached_product_id);
CREATE INDEX IF NOT EXISTS idx_presentation_products_status ON presentation_products(match_status);


-- 2. Project Design Intent
-- Captures the original design goals/vision
CREATE TABLE IF NOT EXISTS project_design_intent (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id TEXT UNIQUE REFERENCES projects(id) ON DELETE CASCADE,

    -- Style goals
    style_goals TEXT[] DEFAULT '{}', -- ['modern', 'warm', 'natural']
    material_preferences TEXT[] DEFAULT '{}', -- ['stone', 'wood', 'brass']
    color_palette JSONB DEFAULT '[]', -- Desired colors

    -- Budget context
    budget_tier TEXT, -- budget, mid, premium, luxury
    budget_notes TEXT,

    -- Room priorities
    priority_rooms TEXT[] DEFAULT '{}', -- Which rooms matter most

    -- Original presentation
    presentation_file_url TEXT,
    presentation_parsed_at TIMESTAMPTZ,
    presentation_product_count INT DEFAULT 0,

    -- Mood/inspiration
    mood_keywords TEXT[] DEFAULT '{}', -- ['cozy', 'sophisticated', 'organic']
    inspiration_urls TEXT[] DEFAULT '{}',
    client_notes TEXT,

    -- AI-extracted intent (from presentation analysis)
    ai_detected_style TEXT,
    ai_detected_mood JSONB,
    ai_confidence TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);


-- 3. Selection History (Changelog)
-- Tracks every change to selections in a project
CREATE TABLE IF NOT EXISTS selection_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- What was changed
    selection_id TEXT REFERENCES selections(id) ON DELETE SET NULL,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    room_id TEXT,
    slot_key TEXT,

    -- Action type
    action TEXT NOT NULL, -- 'created', 'updated', 'deleted', 'swapped', 'restored'

    -- Who made the change
    changed_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    changed_by_role TEXT, -- 'designer', 'client', 'collaborator', 'system'

    -- Product before/after
    previous_cached_product_id UUID REFERENCES cached_products(id) ON DELETE SET NULL,
    new_cached_product_id UUID REFERENCES cached_products(id) ON DELETE SET NULL,

    -- What specifically changed (for updates)
    changed_fields JSONB, -- { "unitPrice": { "from": 100, "to": 120 }, "notes": { "from": "", "to": "..." } }

    -- Why it changed
    reason_category TEXT, -- 'budget', 'availability', 'client_preference', 'design_change', 'substitution', 'error_correction'
    reason_notes TEXT,

    -- Context
    source TEXT, -- 'designer_board', 'import', 'presentation', 'client_portal', 'ai_suggestion'

    -- Snapshot of selection state at this point
    selection_snapshot JSONB,

    changed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_selection_history_selection ON selection_history(selection_id);
CREATE INDEX IF NOT EXISTS idx_selection_history_project ON selection_history(project_id);
CREATE INDEX IF NOT EXISTS idx_selection_history_user ON selection_history(changed_by_user_id);
CREATE INDEX IF NOT EXISTS idx_selection_history_action ON selection_history(action);
CREATE INDEX IF NOT EXISTS idx_selection_history_reason ON selection_history(reason_category);
CREATE INDEX IF NOT EXISTS idx_selection_history_changed_at ON selection_history(changed_at DESC);


-- 4. Project Design Journey (Materialized Summary)
-- Aggregated view of how a project evolved
CREATE TABLE IF NOT EXISTS project_design_journey (
    project_id TEXT PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,

    -- Original vs final counts
    presentation_product_count INT DEFAULT 0,
    final_selection_count INT DEFAULT 0,

    -- Product journey
    products_kept INT DEFAULT 0, -- from presentation to final
    products_swapped INT DEFAULT 0, -- replaced with different product
    products_added INT DEFAULT 0, -- not in original presentation
    products_removed INT DEFAULT 0, -- in presentation but dropped

    -- Change attribution
    total_changes INT DEFAULT 0,
    changes_by_designer INT DEFAULT 0,
    changes_by_client INT DEFAULT 0,
    changes_by_collaborator INT DEFAULT 0,
    changes_by_system INT DEFAULT 0,

    -- Reason breakdown
    changes_for_budget INT DEFAULT 0,
    changes_for_availability INT DEFAULT 0,
    changes_for_client_preference INT DEFAULT 0,
    changes_for_design_change INT DEFAULT 0,
    changes_for_substitution INT DEFAULT 0,
    changes_for_other INT DEFAULT 0,

    -- Style analysis
    original_style_tags JSONB DEFAULT '[]',
    final_style_tags JSONB DEFAULT '[]',
    style_consistency_score DECIMAL(5,2), -- 0-100, how much final matches original
    style_drift_notes TEXT,

    -- Timeline
    first_change_at TIMESTAMPTZ,
    last_change_at TIMESTAMPTZ,
    avg_changes_per_day DECIMAL(5,2),

    -- Computed insights
    budget_impact_percent DECIMAL(5,2), -- % of changes due to budget
    client_influence_score DECIMAL(5,2), -- how much client changed things

    computed_at TIMESTAMPTZ DEFAULT NOW()
);


-- 5. Swap Patterns
-- Track common product substitutions across all projects
CREATE TABLE IF NOT EXISTS swap_patterns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- The swap: from → to
    from_product_id UUID REFERENCES cached_products(id) ON DELETE CASCADE,
    to_product_id UUID REFERENCES cached_products(id) ON DELETE CASCADE,

    -- OR brand-level swaps
    from_brand TEXT,
    to_brand TEXT,

    -- Context
    material_type TEXT,
    role TEXT, -- countertop, backsplash, etc.

    -- Frequency
    swap_count INT DEFAULT 1,

    -- Why these swaps happen
    common_reasons JSONB DEFAULT '[]', -- [{ "reason": "budget", "count": 5 }, ...]

    -- Quality signal
    avg_project_satisfaction DECIMAL(3,2), -- if we track this

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT unique_product_swap UNIQUE (from_product_id, to_product_id),
    CONSTRAINT unique_brand_swap UNIQUE (from_brand, to_brand)
        WHERE from_product_id IS NULL AND to_product_id IS NULL
);

CREATE INDEX IF NOT EXISTS idx_swap_patterns_from ON swap_patterns(from_product_id);
CREATE INDEX IF NOT EXISTS idx_swap_patterns_to ON swap_patterns(to_product_id);
CREATE INDEX IF NOT EXISTS idx_swap_patterns_from_brand ON swap_patterns(from_brand);
CREATE INDEX IF NOT EXISTS idx_swap_patterns_count ON swap_patterns(swap_count DESC);


-- =====================================================
-- Helper Functions
-- =====================================================

-- Function to record a selection change
CREATE OR REPLACE FUNCTION record_selection_change(
    p_selection_id TEXT,
    p_project_id TEXT,
    p_room_id TEXT,
    p_slot_key TEXT,
    p_action TEXT,
    p_changed_by_user_id TEXT,
    p_changed_by_role TEXT,
    p_previous_product_id UUID,
    p_new_product_id UUID,
    p_reason_category TEXT DEFAULT NULL,
    p_reason_notes TEXT DEFAULT NULL,
    p_source TEXT DEFAULT 'designer_board',
    p_changed_fields JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO selection_history (
        selection_id, project_id, room_id, slot_key,
        action, changed_by_user_id, changed_by_role,
        previous_cached_product_id, new_cached_product_id,
        reason_category, reason_notes, source, changed_fields
    )
    VALUES (
        p_selection_id, p_project_id, p_room_id, p_slot_key,
        p_action, p_changed_by_user_id, p_changed_by_role,
        p_previous_product_id, p_new_product_id,
        p_reason_category, p_reason_notes, p_source, p_changed_fields
    )
    RETURNING id INTO v_id;

    -- If this is a swap, record the swap pattern
    IF p_action = 'swapped' AND p_previous_product_id IS NOT NULL AND p_new_product_id IS NOT NULL THEN
        INSERT INTO swap_patterns (from_product_id, to_product_id, swap_count, common_reasons)
        VALUES (
            p_previous_product_id,
            p_new_product_id,
            1,
            CASE WHEN p_reason_category IS NOT NULL
                 THEN jsonb_build_array(jsonb_build_object('reason', p_reason_category, 'count', 1))
                 ELSE '[]'::jsonb
            END
        )
        ON CONFLICT (from_product_id, to_product_id)
        DO UPDATE SET
            swap_count = swap_patterns.swap_count + 1,
            common_reasons = CASE
                WHEN p_reason_category IS NOT NULL THEN
                    -- Add or increment the reason count
                    (SELECT jsonb_agg(
                        CASE
                            WHEN elem->>'reason' = p_reason_category
                            THEN jsonb_set(elem, '{count}', to_jsonb((elem->>'count')::int + 1))
                            ELSE elem
                        END
                    )
                    FROM jsonb_array_elements(
                        CASE
                            WHEN NOT swap_patterns.common_reasons @> jsonb_build_array(jsonb_build_object('reason', p_reason_category))
                            THEN swap_patterns.common_reasons || jsonb_build_array(jsonb_build_object('reason', p_reason_category, 'count', 1))
                            ELSE swap_patterns.common_reasons
                        END
                    ) elem)
                ELSE swap_patterns.common_reasons
            END,
            updated_at = NOW();
    END IF;

    RETURN v_id;
END;
$$ LANGUAGE plpgsql;


-- Function to compute project design journey
CREATE OR REPLACE FUNCTION compute_project_journey(p_project_id TEXT)
RETURNS VOID AS $$
DECLARE
    v_presentation_count INT;
    v_final_count INT;
    v_kept INT;
    v_history RECORD;
BEGIN
    -- Count presentation products
    SELECT COUNT(*) INTO v_presentation_count
    FROM presentation_products
    WHERE project_id = p_project_id;

    -- Count final selections
    SELECT COUNT(*) INTO v_final_count
    FROM selections
    WHERE project_id = p_project_id;

    -- Count kept products (in both presentation and final)
    SELECT COUNT(*) INTO v_kept
    FROM presentation_products pp
    WHERE pp.project_id = p_project_id
      AND pp.kept_in_final = true;

    -- Aggregate history stats
    SELECT
        COUNT(*) as total_changes,
        COUNT(*) FILTER (WHERE changed_by_role = 'designer') as by_designer,
        COUNT(*) FILTER (WHERE changed_by_role = 'client') as by_client,
        COUNT(*) FILTER (WHERE changed_by_role = 'collaborator') as by_collaborator,
        COUNT(*) FILTER (WHERE changed_by_role = 'system') as by_system,
        COUNT(*) FILTER (WHERE reason_category = 'budget') as for_budget,
        COUNT(*) FILTER (WHERE reason_category = 'availability') as for_availability,
        COUNT(*) FILTER (WHERE reason_category = 'client_preference') as for_client_pref,
        COUNT(*) FILTER (WHERE reason_category = 'design_change') as for_design,
        COUNT(*) FILTER (WHERE reason_category = 'substitution') as for_substitution,
        COUNT(*) FILTER (WHERE reason_category NOT IN ('budget', 'availability', 'client_preference', 'design_change', 'substitution') OR reason_category IS NULL) as for_other,
        MIN(changed_at) as first_change,
        MAX(changed_at) as last_change
    INTO v_history
    FROM selection_history
    WHERE project_id = p_project_id;

    -- Upsert journey record
    INSERT INTO project_design_journey (
        project_id,
        presentation_product_count,
        final_selection_count,
        products_kept,
        products_swapped,
        products_added,
        products_removed,
        total_changes,
        changes_by_designer,
        changes_by_client,
        changes_by_collaborator,
        changes_by_system,
        changes_for_budget,
        changes_for_availability,
        changes_for_client_preference,
        changes_for_design_change,
        changes_for_substitution,
        changes_for_other,
        first_change_at,
        last_change_at,
        computed_at
    )
    VALUES (
        p_project_id,
        v_presentation_count,
        v_final_count,
        v_kept,
        COALESCE(v_history.total_changes, 0) - v_kept, -- rough estimate
        v_final_count - v_kept,
        v_presentation_count - v_kept,
        COALESCE(v_history.total_changes, 0),
        COALESCE(v_history.by_designer, 0),
        COALESCE(v_history.by_client, 0),
        COALESCE(v_history.by_collaborator, 0),
        COALESCE(v_history.by_system, 0),
        COALESCE(v_history.for_budget, 0),
        COALESCE(v_history.for_availability, 0),
        COALESCE(v_history.for_client_pref, 0),
        COALESCE(v_history.for_design, 0),
        COALESCE(v_history.for_substitution, 0),
        COALESCE(v_history.for_other, 0),
        v_history.first_change,
        v_history.last_change,
        NOW()
    )
    ON CONFLICT (project_id)
    DO UPDATE SET
        presentation_product_count = EXCLUDED.presentation_product_count,
        final_selection_count = EXCLUDED.final_selection_count,
        products_kept = EXCLUDED.products_kept,
        products_swapped = EXCLUDED.products_swapped,
        products_added = EXCLUDED.products_added,
        products_removed = EXCLUDED.products_removed,
        total_changes = EXCLUDED.total_changes,
        changes_by_designer = EXCLUDED.changes_by_designer,
        changes_by_client = EXCLUDED.changes_by_client,
        changes_by_collaborator = EXCLUDED.changes_by_collaborator,
        changes_by_system = EXCLUDED.changes_by_system,
        changes_for_budget = EXCLUDED.changes_for_budget,
        changes_for_availability = EXCLUDED.changes_for_availability,
        changes_for_client_preference = EXCLUDED.changes_for_client_preference,
        changes_for_design_change = EXCLUDED.changes_for_design_change,
        changes_for_substitution = EXCLUDED.changes_for_substitution,
        changes_for_other = EXCLUDED.changes_for_other,
        first_change_at = EXCLUDED.first_change_at,
        last_change_at = EXCLUDED.last_change_at,
        computed_at = NOW();
END;
$$ LANGUAGE plpgsql;


-- Add triggers for updated_at
DROP TRIGGER IF EXISTS update_project_design_intent_updated_at ON project_design_intent;
CREATE TRIGGER update_project_design_intent_updated_at
    BEFORE UPDATE ON project_design_intent
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_swap_patterns_updated_at ON swap_patterns;
CREATE TRIGGER update_swap_patterns_updated_at
    BEFORE UPDATE ON swap_patterns
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();


-- =====================================================
-- Sample Queries
-- =====================================================

-- Get project journey summary
-- SELECT * FROM project_design_journey WHERE project_id = 'xxx';

-- Get all changes for a project with product details
-- SELECT
--     sh.*,
--     prev.product_name as previous_product,
--     prev.brand as previous_brand,
--     new.product_name as new_product,
--     new.brand as new_brand,
--     u.name as changed_by_name
-- FROM selection_history sh
-- LEFT JOIN cached_products prev ON prev.id = sh.previous_cached_product_id
-- LEFT JOIN cached_products new ON new.id = sh.new_cached_product_id
-- LEFT JOIN users u ON u.id = sh.changed_by_user_id
-- WHERE sh.project_id = 'xxx'
-- ORDER BY sh.changed_at;

-- Get common swap patterns
-- SELECT
--     fp.product_name as from_product,
--     fp.brand as from_brand,
--     tp.product_name as to_product,
--     tp.brand as to_brand,
--     sp.swap_count,
--     sp.common_reasons
-- FROM swap_patterns sp
-- JOIN cached_products fp ON fp.id = sp.from_product_id
-- JOIN cached_products tp ON tp.id = sp.to_product_id
-- ORDER BY sp.swap_count DESC
-- LIMIT 20;

-- Compare presentation to final selections
-- SELECT
--     pp.extracted_name as original_product,
--     pp.suggested_role,
--     pp.kept_in_final,
--     s.product_name as final_product,
--     CASE WHEN pp.kept_in_final THEN 'Kept'
--          WHEN s.id IS NOT NULL THEN 'Swapped'
--          ELSE 'Removed'
--     END as status
-- FROM presentation_products pp
-- LEFT JOIN selections s ON s.id = pp.final_selection_id
-- WHERE pp.project_id = 'xxx';

COMMENT ON TABLE presentation_products IS 'Products extracted from original presentations before matching to catalog';
COMMENT ON TABLE project_design_intent IS 'Original design goals and vision for a project';
COMMENT ON TABLE selection_history IS 'Changelog tracking every selection change with attribution';
COMMENT ON TABLE project_design_journey IS 'Materialized summary of how a project evolved';
COMMENT ON TABLE swap_patterns IS 'Common product substitutions across all projects';
