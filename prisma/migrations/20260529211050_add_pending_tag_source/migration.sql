-- Add PendingTagSource enum + PendingProductTag.source column.
-- Idempotent: enum guarded with DO $$ (duplicate_object), column added IF NOT EXISTS.
-- Default 'VISION' back-fills existing rows (all current tags come from the
-- image-analysis pipeline).

DO $$ BEGIN
  CREATE TYPE "PendingTagSource" AS ENUM ('VISION', 'SPEC');
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE "pending_product_tags"
  ADD COLUMN IF NOT EXISTS "source" "PendingTagSource" NOT NULL DEFAULT 'VISION';
