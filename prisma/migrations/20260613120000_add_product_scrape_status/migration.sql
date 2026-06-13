-- Flagged-domain BQL scrape lifecycle (spec 17 Phase 2b). ADD-only, idempotent.
-- Mirrors the existing mesh3dStatus column: 'pending' | 'complete' | 'failed',
-- NULL for products that never needed the escalation rung. No backfill needed:
-- legacy rows stay NULL, which the app treats as "never scraped via BQL".

ALTER TABLE "products"
  ADD COLUMN IF NOT EXISTS "scrapeStatus" TEXT;
