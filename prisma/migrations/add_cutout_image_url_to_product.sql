-- Add cutoutImageUrl column to products table
-- This migration adds the cutoutImageUrl field for storing 2D cutout PNG URLs (transparent background for moodboards).
-- The field is nullable and serves as the source of truth for idempotency.

DO $$ 
BEGIN
    -- Check if column already exists before adding it
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'products' 
        AND column_name = 'cutoutImageUrl'
    ) THEN
        ALTER TABLE "products" ADD COLUMN "cutoutImageUrl" TEXT;
        
        -- Add a comment to document the field's purpose
        COMMENT ON COLUMN "products"."cutoutImageUrl" IS 'URL to generated 2D cutout PNG (transparent background for moodboards). Source of truth for idempotency: if non-null, the product already has a cutout and will be skipped.';
    ELSE
        RAISE NOTICE 'Column cutoutImageUrl already exists in products table. Skipping.';
    END IF;
END $$;




