-- Phase 5H2: record existing designer_activity_profiles in migration history.
-- Table was created hand-managed prior to reliable migration system.
-- CREATE TABLE IF NOT EXISTS for idempotency — prod is untouched; shadow DB gets the table on replay.
-- Column types lifted from information_schema.columns against prod (2026-04-21).

CREATE TABLE IF NOT EXISTS "designer_activity_profiles" (
    "id" TEXT NOT NULL,
    "designerId" TEXT NOT NULL,
    "totalEventsAttended" INTEGER NOT NULL DEFAULT 0,
    "totalProductsSaved" INTEGER NOT NULL DEFAULT 0,
    "totalProjectsActive" INTEGER NOT NULL DEFAULT 0,
    "totalVendorsEngaged" INTEGER NOT NULL DEFAULT 0,
    "eventEngagementScore" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "productEngagementScore" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "vendorEngagementScore" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "preferredEventTypes" TEXT[] DEFAULT ARRAY[]::text[],
    "preferredProductCategories" TEXT[] DEFAULT ARRAY[]::text[],
    "preferredVendors" TEXT[] DEFAULT ARRAY[]::text[],
    "activeProjectCount" INTEGER NOT NULL DEFAULT 0,
    "recentSavesCount" INTEGER NOT NULL DEFAULT 0,
    "recentEngagementsCount" INTEGER NOT NULL DEFAULT 0,
    "lastEventAttendedAt" TIMESTAMP(3),
    "lastProductSavedAt" TIMESTAMP(3),
    "lastVendorEngagedAt" TIMESTAMP(3),
    "proximityToPurchaseScore" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "lifecycleScore" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    ,
    CONSTRAINT "designer_activity_profiles_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "designer_activity_profiles_designerId_idx" ON public.designer_activity_profiles USING btree ("designerId");
CREATE UNIQUE INDEX IF NOT EXISTS "designer_activity_profiles_designerId_key" ON public.designer_activity_profiles USING btree ("designerId");
CREATE INDEX IF NOT EXISTS "designer_activity_profiles_lifecycleScore_idx" ON public.designer_activity_profiles USING btree ("lifecycleScore");
CREATE INDEX IF NOT EXISTS "designer_activity_profiles_proximityToPurchaseScore_idx" ON public.designer_activity_profiles USING btree ("proximityToPurchaseScore");

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'designer_activity_profiles_designerId_fkey') THEN
        ALTER TABLE "designer_activity_profiles" ADD CONSTRAINT "designer_activity_profiles_designerId_fkey" FOREIGN KEY ("designerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
