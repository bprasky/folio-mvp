-- =====================================================
-- Designer Fingerprint Tracking
-- Extends relationship tracking with per-designer patterns
-- Run this SQL directly in your database
-- =====================================================

-- 1. Designer Product Affinity
-- Tracks which products/brands/materials a designer uses frequently
CREATE TABLE IF NOT EXISTS designer_product_affinity (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    designer_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- What they're affiliated with (one of these will be set)
    cached_product_id UUID REFERENCES cached_products(id) ON DELETE CASCADE,
    brand_name TEXT, -- Normalized brand name
    material_type TEXT, -- stone, tile, wood, etc.
    style TEXT, -- modern, traditional, etc.

    -- Affinity metrics
    use_count INTEGER DEFAULT 1,
    project_count INTEGER DEFAULT 1, -- Unique projects
    first_used_at TIMESTAMPTZ DEFAULT NOW(),
    last_used_at TIMESTAMPTZ DEFAULT NOW(),

    -- Engagement signals
    total_likes_received INTEGER DEFAULT 0, -- Likes on projects using this
    total_saves_received INTEGER DEFAULT 0,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_designer_affinity_designer ON designer_product_affinity(designer_id);
CREATE INDEX IF NOT EXISTS idx_designer_affinity_product ON designer_product_affinity(cached_product_id);
CREATE INDEX IF NOT EXISTS idx_designer_affinity_brand ON designer_product_affinity(brand_name);
CREATE INDEX IF NOT EXISTS idx_designer_affinity_material ON designer_product_affinity(material_type);
CREATE INDEX IF NOT EXISTS idx_designer_affinity_style ON designer_product_affinity(style);
CREATE INDEX IF NOT EXISTS idx_designer_affinity_use_count ON designer_product_affinity(use_count DESC);

-- Unique constraints for each affinity type
CREATE UNIQUE INDEX IF NOT EXISTS idx_designer_product_unique
    ON designer_product_affinity(designer_id, cached_product_id)
    WHERE cached_product_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_designer_brand_unique
    ON designer_product_affinity(designer_id, brand_name)
    WHERE brand_name IS NOT NULL AND cached_product_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_designer_material_unique
    ON designer_product_affinity(designer_id, material_type)
    WHERE material_type IS NOT NULL AND cached_product_id IS NULL AND brand_name IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_designer_style_unique
    ON designer_product_affinity(designer_id, style)
    WHERE style IS NOT NULL AND cached_product_id IS NULL AND brand_name IS NULL AND material_type IS NULL;


-- 2. Designer Pairings
-- What products THIS designer uses together (vs aggregate in product_pairings)
CREATE TABLE IF NOT EXISTS designer_pairings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    designer_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- The two products (ordered: product_a_id < product_b_id)
    product_a_id UUID NOT NULL REFERENCES cached_products(id) ON DELETE CASCADE,
    product_b_id UUID NOT NULL REFERENCES cached_products(id) ON DELETE CASCADE,

    -- Context
    room_type TEXT, -- kitchen, bathroom, etc.

    -- Pairing strength for THIS designer
    pair_count INTEGER DEFAULT 1,
    same_room_count INTEGER DEFAULT 0,

    -- Quality signals for THIS designer's projects
    avg_likes DECIMAL(5,2) DEFAULT 0,
    avg_saves DECIMAL(5,2) DEFAULT 0,

    first_paired_at TIMESTAMPTZ DEFAULT NOW(),
    last_paired_at TIMESTAMPTZ DEFAULT NOW(),

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Ensure unique pairing per designer and consistent ordering
    CONSTRAINT unique_designer_pair UNIQUE (designer_id, product_a_id, product_b_id),
    CONSTRAINT designer_ordered_pair CHECK (product_a_id < product_b_id)
);

CREATE INDEX IF NOT EXISTS idx_designer_pairings_designer ON designer_pairings(designer_id);
CREATE INDEX IF NOT EXISTS idx_designer_pairings_a ON designer_pairings(product_a_id);
CREATE INDEX IF NOT EXISTS idx_designer_pairings_b ON designer_pairings(product_b_id);
CREATE INDEX IF NOT EXISTS idx_designer_pairings_room ON designer_pairings(room_type);
CREATE INDEX IF NOT EXISTS idx_designer_pairings_count ON designer_pairings(pair_count DESC);


-- 3. Designer Style Profile
-- Aggregated style fingerprint for each designer
CREATE TABLE IF NOT EXISTS designer_style_profile (
    designer_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,

    -- Material preferences (percentages, sum to ~100)
    material_breakdown JSONB DEFAULT '{}', -- { "stone": 35, "tile": 25, "wood": 20, ... }

    -- Style preferences
    style_breakdown JSONB DEFAULT '{}', -- { "modern": 45, "transitional": 30, ... }

    -- Price tier preferences
    price_tier_breakdown JSONB DEFAULT '{}', -- { "luxury": 40, "premium": 35, "mid": 25 }

    -- Top brands (ordered by usage)
    top_brands JSONB DEFAULT '[]', -- [{ "name": "Artistic Tile", "count": 12, "percent": 15 }, ...]

    -- Room type preferences
    room_type_breakdown JSONB DEFAULT '{}', -- { "kitchen": 40, "bath": 35, ... }

    -- Signature pairings (what they uniquely use together vs aggregate)
    signature_pairings JSONB DEFAULT '[]', -- Products they pair more than average

    -- Delta from aggregate (how different from average designer)
    aggregate_delta_score DECIMAL(5,2) DEFAULT 0, -- 0 = average, higher = more unique

    -- Stats
    total_products_used INTEGER DEFAULT 0,
    total_projects INTEGER DEFAULT 0,
    total_selections INTEGER DEFAULT 0,

    -- Quality metrics
    avg_project_likes DECIMAL(5,2) DEFAULT 0,
    avg_project_saves DECIMAL(5,2) DEFAULT 0,

    -- Timestamps
    profile_computed_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);


-- 4. Pairing Delta View
-- Compare individual designer pairings to aggregate pairings
CREATE OR REPLACE VIEW designer_pairing_deltas AS
SELECT
    dp.designer_id,
    dp.product_a_id,
    dp.product_b_id,
    dp.pair_count as designer_pair_count,
    COALESCE(pp.pair_count, 0) as aggregate_pair_count,
    -- Delta: positive means designer uses this combo MORE than average
    dp.pair_count - COALESCE(pp.pair_count, 0) as count_delta,
    -- Ratio: > 1 means designer prefers this more than average
    CASE
        WHEN COALESCE(pp.pair_count, 1) > 0
        THEN dp.pair_count::DECIMAL / COALESCE(pp.pair_count, 1)
        ELSE dp.pair_count::DECIMAL
    END as preference_ratio,
    dp.room_type,
    dp.avg_likes as designer_avg_likes,
    COALESCE(pp.avg_project_likes, 0) as aggregate_avg_likes
FROM designer_pairings dp
LEFT JOIN product_pairings pp
    ON dp.product_a_id = pp.product_a_id
    AND dp.product_b_id = pp.product_b_id;


-- =====================================================
-- Helper Functions
-- =====================================================

-- Function to upsert designer product affinity
CREATE OR REPLACE FUNCTION upsert_designer_product_affinity(
    p_designer_id TEXT,
    p_cached_product_id UUID,
    p_brand_name TEXT DEFAULT NULL,
    p_material_type TEXT DEFAULT NULL,
    p_style TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_id UUID;
    v_normalized_brand TEXT;
BEGIN
    -- Normalize brand name
    v_normalized_brand := CASE
        WHEN p_brand_name IS NOT NULL
        THEN lower(regexp_replace(p_brand_name, '[^a-zA-Z0-9]', '', 'g'))
        ELSE NULL
    END;

    -- Upsert product affinity
    IF p_cached_product_id IS NOT NULL THEN
        INSERT INTO designer_product_affinity (designer_id, cached_product_id, use_count)
        VALUES (p_designer_id, p_cached_product_id, 1)
        ON CONFLICT (designer_id, cached_product_id) WHERE cached_product_id IS NOT NULL
        DO UPDATE SET
            use_count = designer_product_affinity.use_count + 1,
            last_used_at = NOW(),
            updated_at = NOW()
        RETURNING id INTO v_id;
    END IF;

    -- Also track brand affinity if brand provided
    IF v_normalized_brand IS NOT NULL THEN
        INSERT INTO designer_product_affinity (designer_id, brand_name, use_count)
        VALUES (p_designer_id, v_normalized_brand, 1)
        ON CONFLICT (designer_id, brand_name) WHERE brand_name IS NOT NULL AND cached_product_id IS NULL
        DO UPDATE SET
            use_count = designer_product_affinity.use_count + 1,
            last_used_at = NOW(),
            updated_at = NOW();
    END IF;

    -- Track material affinity if provided
    IF p_material_type IS NOT NULL THEN
        INSERT INTO designer_product_affinity (designer_id, material_type, use_count)
        VALUES (p_designer_id, p_material_type, 1)
        ON CONFLICT (designer_id, material_type) WHERE material_type IS NOT NULL AND cached_product_id IS NULL AND brand_name IS NULL
        DO UPDATE SET
            use_count = designer_product_affinity.use_count + 1,
            last_used_at = NOW(),
            updated_at = NOW();
    END IF;

    -- Track style affinity if provided
    IF p_style IS NOT NULL THEN
        INSERT INTO designer_product_affinity (designer_id, style, use_count)
        VALUES (p_designer_id, p_style, 1)
        ON CONFLICT (designer_id, style) WHERE style IS NOT NULL AND cached_product_id IS NULL AND brand_name IS NULL AND material_type IS NULL
        DO UPDATE SET
            use_count = designer_product_affinity.use_count + 1,
            last_used_at = NOW(),
            updated_at = NOW();
    END IF;

    RETURN v_id;
END;
$$ LANGUAGE plpgsql;


-- Function to upsert designer pairing
CREATE OR REPLACE FUNCTION upsert_designer_pairing(
    p_designer_id TEXT,
    p_product_a UUID,
    p_product_b UUID,
    p_room_type TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_id UUID;
    v_a UUID;
    v_b UUID;
BEGIN
    -- Ensure consistent ordering
    IF p_product_a < p_product_b THEN
        v_a := p_product_a;
        v_b := p_product_b;
    ELSE
        v_a := p_product_b;
        v_b := p_product_a;
    END IF;

    -- Upsert designer pairing
    INSERT INTO designer_pairings (designer_id, product_a_id, product_b_id, room_type, pair_count)
    VALUES (p_designer_id, v_a, v_b, p_room_type, 1)
    ON CONFLICT (designer_id, product_a_id, product_b_id)
    DO UPDATE SET
        pair_count = designer_pairings.pair_count + 1,
        same_room_count = CASE
            WHEN p_room_type IS NOT NULL
            THEN designer_pairings.same_room_count + 1
            ELSE designer_pairings.same_room_count
        END,
        last_paired_at = NOW(),
        updated_at = NOW()
    RETURNING id INTO v_id;

    -- Also update the aggregate pairing
    PERFORM upsert_product_pairing(v_a, v_b, p_room_type);

    RETURN v_id;
END;
$$ LANGUAGE plpgsql;


-- Function to compute designer style profile
CREATE OR REPLACE FUNCTION compute_designer_style_profile(p_designer_id TEXT)
RETURNS VOID AS $$
DECLARE
    v_total_products INTEGER;
    v_material_breakdown JSONB;
    v_style_breakdown JSONB;
    v_top_brands JSONB;
    v_total_projects INTEGER;
    v_total_selections INTEGER;
BEGIN
    -- Get total products used
    SELECT COUNT(DISTINCT cached_product_id)
    INTO v_total_products
    FROM designer_product_affinity
    WHERE designer_id = p_designer_id AND cached_product_id IS NOT NULL;

    -- Compute material breakdown
    SELECT COALESCE(jsonb_object_agg(material_type, pct), '{}')
    INTO v_material_breakdown
    FROM (
        SELECT
            material_type,
            ROUND(100.0 * use_count / NULLIF(SUM(use_count) OVER (), 0), 1) as pct
        FROM designer_product_affinity
        WHERE designer_id = p_designer_id
            AND material_type IS NOT NULL
            AND cached_product_id IS NULL
            AND brand_name IS NULL
    ) sub;

    -- Compute style breakdown
    SELECT COALESCE(jsonb_object_agg(style, pct), '{}')
    INTO v_style_breakdown
    FROM (
        SELECT
            style,
            ROUND(100.0 * use_count / NULLIF(SUM(use_count) OVER (), 0), 1) as pct
        FROM designer_product_affinity
        WHERE designer_id = p_designer_id
            AND style IS NOT NULL
            AND cached_product_id IS NULL
            AND brand_name IS NULL
            AND material_type IS NULL
    ) sub;

    -- Get top brands
    SELECT COALESCE(jsonb_agg(brand_data ORDER BY use_count DESC), '[]')
    INTO v_top_brands
    FROM (
        SELECT jsonb_build_object(
            'name', brand_name,
            'count', use_count
        ) as brand_data, use_count
        FROM designer_product_affinity
        WHERE designer_id = p_designer_id
            AND brand_name IS NOT NULL
            AND cached_product_id IS NULL
        ORDER BY use_count DESC
        LIMIT 10
    ) sub;

    -- Get project and selection counts
    SELECT COUNT(DISTINCT project_id), COUNT(*)
    INTO v_total_projects, v_total_selections
    FROM selections s
    JOIN selection_cached_product scp ON scp.selection_id = s.id
    JOIN projects p ON p.id = s.project_id
    WHERE p.user_id = p_designer_id;

    -- Upsert profile
    INSERT INTO designer_style_profile (
        designer_id,
        material_breakdown,
        style_breakdown,
        top_brands,
        total_products_used,
        total_projects,
        total_selections,
        profile_computed_at
    )
    VALUES (
        p_designer_id,
        v_material_breakdown,
        v_style_breakdown,
        v_top_brands,
        v_total_products,
        v_total_projects,
        v_total_selections,
        NOW()
    )
    ON CONFLICT (designer_id)
    DO UPDATE SET
        material_breakdown = EXCLUDED.material_breakdown,
        style_breakdown = EXCLUDED.style_breakdown,
        top_brands = EXCLUDED.top_brands,
        total_products_used = EXCLUDED.total_products_used,
        total_projects = EXCLUDED.total_projects,
        total_selections = EXCLUDED.total_selections,
        profile_computed_at = NOW(),
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;


-- Add triggers for updated_at
DROP TRIGGER IF EXISTS update_designer_product_affinity_updated_at ON designer_product_affinity;
CREATE TRIGGER update_designer_product_affinity_updated_at
    BEFORE UPDATE ON designer_product_affinity
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_designer_pairings_updated_at ON designer_pairings;
CREATE TRIGGER update_designer_pairings_updated_at
    BEFORE UPDATE ON designer_pairings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_designer_style_profile_updated_at ON designer_style_profile;
CREATE TRIGGER update_designer_style_profile_updated_at
    BEFORE UPDATE ON designer_style_profile
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();


-- =====================================================
-- Sample Queries for Designer Insights
-- =====================================================

-- Get a designer's signature pairings (what they use more than average)
-- SELECT * FROM designer_pairing_deltas
-- WHERE designer_id = 'designer-id'
-- AND preference_ratio > 1.5
-- ORDER BY preference_ratio DESC;

-- Get a designer's top materials
-- SELECT material_type, use_count
-- FROM designer_product_affinity
-- WHERE designer_id = 'designer-id'
-- AND material_type IS NOT NULL
-- AND cached_product_id IS NULL
-- ORDER BY use_count DESC;

-- Compare designer to aggregate material usage
-- WITH aggregate_materials AS (
--     SELECT material_type, SUM(use_count) as total
--     FROM designer_product_affinity
--     WHERE material_type IS NOT NULL AND cached_product_id IS NULL AND brand_name IS NULL
--     GROUP BY material_type
-- )
-- SELECT
--     dpa.material_type,
--     dpa.use_count as designer_count,
--     am.total as aggregate_count,
--     ROUND(100.0 * dpa.use_count / NULLIF(am.total, 0), 1) as designer_share_pct
-- FROM designer_product_affinity dpa
-- JOIN aggregate_materials am ON am.material_type = dpa.material_type
-- WHERE dpa.designer_id = 'designer-id'
-- AND dpa.material_type IS NOT NULL
-- AND dpa.cached_product_id IS NULL;

COMMENT ON TABLE designer_product_affinity IS 'Tracks individual designer affinity for products, brands, materials, and styles';
COMMENT ON TABLE designer_pairings IS 'Tracks what products each designer pairs together (vs aggregate)';
COMMENT ON TABLE designer_style_profile IS 'Aggregated style fingerprint for each designer';
COMMENT ON VIEW designer_pairing_deltas IS 'Compares individual designer pairings to aggregate patterns';
