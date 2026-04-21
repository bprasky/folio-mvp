-- Phase 5H2: record existing vendor_product_match_scores in migration history.
-- Table was created hand-managed prior to reliable migration system.
-- CREATE TABLE IF NOT EXISTS for idempotency — prod is untouched; shadow DB gets the table on replay.
-- Column types lifted from information_schema.columns against prod (2026-04-21).

CREATE TABLE IF NOT EXISTS "vendor_product_match_scores" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "designerId" TEXT NOT NULL,
    "styleMatchScore" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "projectMatchScore" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "budgetMatchScore" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "locationMatchScore" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "overallMatchScore" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "projectId" TEXT,
    "eventId" TEXT,
    "hasViewed" BOOLEAN NOT NULL DEFAULT false,
    "hasSaved" BOOLEAN NOT NULL DEFAULT false,
    "hasTagged" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    ,
    CONSTRAINT "vendor_product_match_scores_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "vendor_product_match_scores_designerId_idx" ON public.vendor_product_match_scores USING btree ("designerId");
CREATE INDEX IF NOT EXISTS "vendor_product_match_scores_eventId_idx" ON public.vendor_product_match_scores USING btree ("eventId");
CREATE INDEX IF NOT EXISTS "vendor_product_match_scores_overallMatchScore_idx" ON public.vendor_product_match_scores USING btree ("overallMatchScore");
CREATE UNIQUE INDEX IF NOT EXISTS "vendor_product_match_scores_vendorId_productId_designerId_key" ON public.vendor_product_match_scores USING btree ("vendorId", "productId", "designerId");
CREATE INDEX IF NOT EXISTS "vendor_product_match_scores_vendorId_productId_idx" ON public.vendor_product_match_scores USING btree ("vendorId", "productId");

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vendor_product_match_scores_designerId_fkey') THEN
        ALTER TABLE "vendor_product_match_scores" ADD CONSTRAINT "vendor_product_match_scores_designerId_fkey" FOREIGN KEY ("designerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
