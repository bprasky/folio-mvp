-- Async tagging review: track when a deferred-scrape product tag has been
-- confirmed by the designer. Null = still needs review. ADD-only, idempotent.

ALTER TABLE "product_tags" ADD COLUMN IF NOT EXISTS "reviewedAt" TIMESTAMP(3);
