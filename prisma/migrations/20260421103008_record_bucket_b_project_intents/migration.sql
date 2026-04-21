-- Phase 5H2: record existing project_intents in migration history.
-- Table was created hand-managed prior to reliable migration system.
-- CREATE TABLE IF NOT EXISTS for idempotency — prod is untouched; shadow DB gets the table on replay.
-- Column types lifted from information_schema.columns against prod (2026-04-21).

CREATE TABLE IF NOT EXISTS "project_intents" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "summary" TEXT,
    "clientProfile" JSONB,
    "moodKeywords" TEXT[] DEFAULT ARRAY[]::text[],
    "styleTags" TEXT[] DEFAULT ARRAY[]::text[],
    "budgetLevel" TEXT,
    "keyObjectives" JSONB,
    "constraints" JSONB,
    "optionPolicyDefault" INTEGER,
    "rawState" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    ,
    CONSTRAINT "project_intents_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "project_intents_projectId_idx" ON public.project_intents USING btree ("projectId");
CREATE UNIQUE INDEX IF NOT EXISTS "project_intents_projectId_key" ON public.project_intents USING btree ("projectId");

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'project_intents_projectId_fkey') THEN
        ALTER TABLE "project_intents" ADD CONSTRAINT "project_intents_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
