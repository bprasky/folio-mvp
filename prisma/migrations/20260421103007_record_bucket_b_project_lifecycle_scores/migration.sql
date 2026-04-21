-- Phase 5H2: record existing project_lifecycle_scores in migration history.
-- Table was created hand-managed prior to reliable migration system.
-- CREATE TABLE IF NOT EXISTS for idempotency — prod is untouched; shadow DB gets the table on replay.
-- Column types lifted from information_schema.columns against prod (2026-04-21).

CREATE TABLE IF NOT EXISTS "project_lifecycle_scores" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "designerId" TEXT NOT NULL,
    "currentStage" "ProjectStage" NOT NULL,
    "procurementReadinessScore" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "budgetClarityScore" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "timelineUrgencyScore" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "overallLifecycleScore" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "hasActiveSelections" BOOLEAN NOT NULL DEFAULT false,
    "hasPendingQuotes" BOOLEAN NOT NULL DEFAULT false,
    "hasRecentActivity" BOOLEAN NOT NULL DEFAULT false,
    "lastActivityAt" TIMESTAMP(3),
    "estimatedProcurementDate" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    ,
    CONSTRAINT "project_lifecycle_scores_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "project_lifecycle_scores_currentStage_idx" ON public.project_lifecycle_scores USING btree ("currentStage");
CREATE INDEX IF NOT EXISTS "project_lifecycle_scores_designerId_idx" ON public.project_lifecycle_scores USING btree ("designerId");
CREATE INDEX IF NOT EXISTS "project_lifecycle_scores_overallLifecycleScore_idx" ON public.project_lifecycle_scores USING btree ("overallLifecycleScore");
CREATE UNIQUE INDEX IF NOT EXISTS "project_lifecycle_scores_projectId_designerId_key" ON public.project_lifecycle_scores USING btree ("projectId", "designerId");
CREATE INDEX IF NOT EXISTS "project_lifecycle_scores_projectId_idx" ON public.project_lifecycle_scores USING btree ("projectId");

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'project_lifecycle_scores_designerId_fkey') THEN
        ALTER TABLE "project_lifecycle_scores" ADD CONSTRAINT "project_lifecycle_scores_designerId_fkey" FOREIGN KEY ("designerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
