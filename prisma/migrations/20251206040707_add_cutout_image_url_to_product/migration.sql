-- Add cutoutImageUrl column to products table
-- Stores 2D cutout PNG URLs (transparent background for moodboards).
-- Idempotent via DO $$ block (check column existence before ADD).

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'products'
        AND column_name = 'cutoutImageUrl'
    ) THEN
        ALTER TABLE "products" ADD COLUMN "cutoutImageUrl" TEXT;
        COMMENT ON COLUMN "products"."cutoutImageUrl" IS 'URL to generated 2D cutout PNG (transparent background for moodboards). Source of truth for idempotency: if non-null, the product already has a cutout and will be skipped.';
    END IF;
END $$;
