-- AddColumn: Add scenePresetId to products table
-- Nullable optional field for vendor/admin scene environment override
-- When NULL, the system auto-selects a preset based on product category

ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "scenePresetId" TEXT;
