-- =====================================================
-- Product Cache & Relationship Tables
-- Run this SQL directly in your database
-- =====================================================

-- 1. Cached Product Catalog
-- Stores product data from URL imports before vendor claims
CREATE TABLE IF NOT EXISTS cached_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- URL is the unique key for lookups
    url TEXT UNIQUE NOT NULL,
    url_hash TEXT GENERATED ALWAYS AS (md5(url)) STORED, -- Fast index

    -- Basic product info (from AI extraction)
    product_name TEXT,
    brand TEXT,
    vendor_name TEXT, -- Retailer/website name
    sku TEXT,
    price_cents INTEGER, -- Store in cents for precision
    currency TEXT DEFAULT 'USD',
    description TEXT,

    -- Image (from Browserless extraction)
    image_url TEXT,

    -- Dimensions (inches)
    width_in DECIMAL(10,2),
    depth_in DECIMAL(10,2),
    height_in DECIMAL(10,2),

    -- AI Classification
    material_type TEXT, -- stone, tile, wood, fabric, metal, lighting, appliance, furniture, other
    style TEXT, -- modern, traditional, transitional, industrial, coastal, farmhouse, etc.
    color_palette JSONB DEFAULT '[]', -- Array of dominant colors
    room_suitability JSONB DEFAULT '{}', -- { kitchen: 0.9, bathroom: 0.7, ... }
    price_tier TEXT, -- budget, mid, premium, luxury

    -- Categories/Tags
    categories TEXT[] DEFAULT '{}',
    tags TEXT[] DEFAULT '{}',

    -- Vendor relationship
    claimed_vendor_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    claimed_org_id TEXT, -- Organization ID when claimed
    status TEXT DEFAULT 'unofficial' CHECK (status IN ('unofficial', 'claimed', 'verified', 'rejected')),

    -- Tracking
    fetch_count INTEGER DEFAULT 1,
    use_count INTEGER DEFAULT 0, -- How many times used in projects
    last_fetched_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Raw AI response for debugging/reprocessing
    ai_response JSONB,
    extraction_confidence TEXT DEFAULT 'medium' CHECK (extraction_confidence IN ('high', 'medium', 'low'))
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_cached_products_url_hash ON cached_products(url_hash);
CREATE INDEX IF NOT EXISTS idx_cached_products_brand ON cached_products(brand);
CREATE INDEX IF NOT EXISTS idx_cached_products_vendor ON cached_products(vendor_name);
CREATE INDEX IF NOT EXISTS idx_cached_products_material ON cached_products(material_type);
CREATE INDEX IF NOT EXISTS idx_cached_products_style ON cached_products(style);
CREATE INDEX IF NOT EXISTS idx_cached_products_status ON cached_products(status);
CREATE INDEX IF NOT EXISTS idx_cached_products_claimed_org ON cached_products(claimed_org_id);

-- 2. Product Pairings
-- Tracks which products are used together in projects
CREATE TABLE IF NOT EXISTS product_pairings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- The two products (order doesn't matter, so we enforce product_a_id < product_b_id)
    product_a_id UUID NOT NULL REFERENCES cached_products(id) ON DELETE CASCADE,
    product_b_id UUID NOT NULL REFERENCES cached_products(id) ON DELETE CASCADE,

    -- Pairing context
    room_type TEXT, -- kitchen, bathroom, living, bedroom, etc.

    -- Strength metrics
    pair_count INTEGER DEFAULT 1, -- How many times paired together
    same_project_count INTEGER DEFAULT 0, -- In same project
    same_room_count INTEGER DEFAULT 0, -- In same room

    -- Quality signals
    avg_project_likes DECIMAL(5,2) DEFAULT 0,
    avg_project_saves DECIMAL(5,2) DEFAULT 0,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Ensure unique pairing and consistent ordering
    CONSTRAINT unique_product_pair UNIQUE (product_a_id, product_b_id),
    CONSTRAINT ordered_pair CHECK (product_a_id < product_b_id)
);

CREATE INDEX IF NOT EXISTS idx_product_pairings_a ON product_pairings(product_a_id);
CREATE INDEX IF NOT EXISTS idx_product_pairings_b ON product_pairings(product_b_id);
CREATE INDEX IF NOT EXISTS idx_product_pairings_room ON product_pairings(room_type);
CREATE INDEX IF NOT EXISTS idx_product_pairings_count ON product_pairings(pair_count DESC);

-- 3. Product Engagement
-- Tracks likes, saves, views on cached products
CREATE TABLE IF NOT EXISTS cached_product_engagement (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    cached_product_id UUID NOT NULL REFERENCES cached_products(id) ON DELETE CASCADE,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,

    engagement_type TEXT NOT NULL CHECK (engagement_type IN ('view', 'like', 'save', 'use', 'share', 'click_url')),

    -- Context
    source TEXT, -- 'import_modal', 'project_board', 'search', 'recommendation'
    project_id TEXT,
    room_id TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_engagement_product ON cached_product_engagement(cached_product_id);
CREATE INDEX IF NOT EXISTS idx_product_engagement_user ON cached_product_engagement(user_id);
CREATE INDEX IF NOT EXISTS idx_product_engagement_type ON cached_product_engagement(engagement_type);
CREATE INDEX IF NOT EXISTS idx_product_engagement_created ON cached_product_engagement(created_at DESC);

-- 4. Selection to Cached Product Link
-- Links selections (in projects) back to cached products
CREATE TABLE IF NOT EXISTS selection_cached_product (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    selection_id TEXT NOT NULL REFERENCES selections(id) ON DELETE CASCADE,
    cached_product_id UUID NOT NULL REFERENCES cached_products(id) ON DELETE CASCADE,

    -- How confident is this link
    match_confidence DECIMAL(3,2) DEFAULT 1.0, -- 0.0 to 1.0
    match_method TEXT DEFAULT 'url', -- 'url', 'ai_match', 'manual'

    created_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT unique_selection_product UNIQUE (selection_id, cached_product_id)
);

CREATE INDEX IF NOT EXISTS idx_selection_cached_product_selection ON selection_cached_product(selection_id);
CREATE INDEX IF NOT EXISTS idx_selection_cached_product_product ON selection_cached_product(cached_product_id);

-- 5. Aggregated Product Stats (materialized for performance)
-- Updated periodically by a background job
CREATE TABLE IF NOT EXISTS cached_product_stats (
    cached_product_id UUID PRIMARY KEY REFERENCES cached_products(id) ON DELETE CASCADE,

    -- Usage stats
    total_uses INTEGER DEFAULT 0,
    unique_projects INTEGER DEFAULT 0,
    unique_designers INTEGER DEFAULT 0,

    -- Engagement stats
    total_views INTEGER DEFAULT 0,
    total_likes INTEGER DEFAULT 0,
    total_saves INTEGER DEFAULT 0,

    -- Pairing stats
    total_pairings INTEGER DEFAULT 0,
    top_paired_products JSONB DEFAULT '[]', -- Array of {product_id, count}

    -- Quality score (computed)
    quality_score DECIMAL(5,2) DEFAULT 0, -- 0-100
    trending_score DECIMAL(5,2) DEFAULT 0, -- Recent momentum

    -- Time-based
    last_used_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Brand/Vendor Registry
-- Tracks brands we've seen, even before they claim
CREATE TABLE IF NOT EXISTS brand_registry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Brand identification
    name TEXT NOT NULL,
    normalized_name TEXT GENERATED ALWAYS AS (lower(regexp_replace(name, '[^a-zA-Z0-9]', '', 'g'))) STORED,

    -- Known URLs
    website_url TEXT,
    known_retailer_urls TEXT[] DEFAULT '{}', -- URLs where this brand is sold

    -- Claimed status
    claimed_org_id TEXT,
    claimed_at TIMESTAMPTZ,

    -- Stats
    product_count INTEGER DEFAULT 0,
    total_uses INTEGER DEFAULT 0,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT unique_normalized_brand UNIQUE (normalized_name)
);

CREATE INDEX IF NOT EXISTS idx_brand_registry_name ON brand_registry(normalized_name);
CREATE INDEX IF NOT EXISTS idx_brand_registry_claimed ON brand_registry(claimed_org_id);

-- =====================================================
-- Helper Functions
-- =====================================================

-- Function to update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add triggers for updated_at
DROP TRIGGER IF EXISTS update_cached_products_updated_at ON cached_products;
CREATE TRIGGER update_cached_products_updated_at
    BEFORE UPDATE ON cached_products
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_product_pairings_updated_at ON product_pairings;
CREATE TRIGGER update_product_pairings_updated_at
    BEFORE UPDATE ON product_pairings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_brand_registry_updated_at ON brand_registry;
CREATE TRIGGER update_brand_registry_updated_at
    BEFORE UPDATE ON brand_registry
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Function to create/update product pairing
CREATE OR REPLACE FUNCTION upsert_product_pairing(
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

    INSERT INTO product_pairings (product_a_id, product_b_id, room_type, pair_count)
    VALUES (v_a, v_b, p_room_type, 1)
    ON CONFLICT (product_a_id, product_b_id)
    DO UPDATE SET
        pair_count = product_pairings.pair_count + 1,
        same_room_count = CASE WHEN p_room_type IS NOT NULL THEN product_pairings.same_room_count + 1 ELSE product_pairings.same_room_count END,
        updated_at = NOW()
    RETURNING id INTO v_id;

    RETURN v_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Sample queries for vendor value prop
-- =====================================================

-- Get most popular products for a brand
-- SELECT * FROM cached_products
-- WHERE brand = 'Artistic Tile'
-- ORDER BY use_count DESC LIMIT 10;

-- Get products commonly paired with a specific product
-- SELECT cp.*, pp.pair_count
-- FROM product_pairings pp
-- JOIN cached_products cp ON cp.id = CASE
--     WHEN pp.product_a_id = 'target-product-id' THEN pp.product_b_id
--     ELSE pp.product_a_id
-- END
-- WHERE pp.product_a_id = 'target-product-id' OR pp.product_b_id = 'target-product-id'
-- ORDER BY pp.pair_count DESC;

-- Get brand stats
-- SELECT
--     br.name,
--     br.product_count,
--     br.total_uses,
--     COUNT(DISTINCT scp.selection_id) as active_selections
-- FROM brand_registry br
-- LEFT JOIN cached_products cp ON lower(cp.brand) = br.normalized_name
-- LEFT JOIN selection_cached_product scp ON scp.cached_product_id = cp.id
-- GROUP BY br.id;

COMMENT ON TABLE cached_products IS 'Cache of products imported from URLs, before vendor claims';
COMMENT ON TABLE product_pairings IS 'Tracks which products are used together in projects';
COMMENT ON TABLE cached_product_engagement IS 'Tracks user engagement with cached products';
COMMENT ON TABLE selection_cached_product IS 'Links selections in projects to cached products';
COMMENT ON TABLE cached_product_stats IS 'Aggregated stats for cached products (updated by background job)';
COMMENT ON TABLE brand_registry IS 'Registry of brands seen, tracking claim status';
