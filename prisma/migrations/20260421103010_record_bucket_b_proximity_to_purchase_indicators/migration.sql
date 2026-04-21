-- Phase 5H2: record existing proximity_to_purchase_indicators in migration history.
-- Table was created hand-managed prior to reliable migration system.
-- CREATE TABLE IF NOT EXISTS for idempotency — prod is untouched; shadow DB gets the table on replay.
-- Column types lifted from information_schema.columns against prod (2026-04-21).

CREATE TABLE IF NOT EXISTS "proximity_to_purchase_indicators" (
    "id" TEXT NOT NULL,
    "designerId" TEXT NOT NULL,
    "proximityScore" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "hasActiveProjects" BOOLEAN NOT NULL DEFAULT false,
    "hasRecentSaves" BOOLEAN NOT NULL DEFAULT false,
    "hasRecentEngagements" BOOLEAN NOT NULL DEFAULT false,
    "hasPendingQuotes" BOOLEAN NOT NULL DEFAULT false,
    "hasRecentEventAttendance" BOOLEAN NOT NULL DEFAULT false,
    "categoryProximityScores" JSONB,
    "lastPurchaseSignalAt" TIMESTAMP(3),
    "estimatedPurchaseWindow" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    ,
    CONSTRAINT "proximity_to_purchase_indicators_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "proximity_to_purchase_indicators_designerId_idx" ON public.proximity_to_purchase_indicators USING btree ("designerId");
CREATE UNIQUE INDEX IF NOT EXISTS "proximity_to_purchase_indicators_designerId_key" ON public.proximity_to_purchase_indicators USING btree ("designerId");
CREATE INDEX IF NOT EXISTS "proximity_to_purchase_indicators_proximityScore_idx" ON public.proximity_to_purchase_indicators USING btree ("proximityScore");

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'proximity_to_purchase_indicators_designerId_fkey') THEN
        ALTER TABLE "proximity_to_purchase_indicators" ADD CONSTRAINT "proximity_to_purchase_indicators_designerId_fkey" FOREIGN KEY ("designerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
