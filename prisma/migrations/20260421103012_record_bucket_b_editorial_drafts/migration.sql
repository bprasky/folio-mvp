-- Phase 5H2: record existing editorial_drafts in migration history.
-- Table was created hand-managed prior to reliable migration system.
-- CREATE TABLE IF NOT EXISTS for idempotency — prod is untouched; shadow DB gets the table on replay.
-- Column types lifted from information_schema.columns against prod (2026-04-21).

CREATE TABLE IF NOT EXISTS "editorial_drafts" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'draft'::text,
    "title" TEXT,
    "subtitle" TEXT,
    "outline" JSONB,
    "bodyMarkdown" TEXT,
    "pullQuotes" JSONB,
    "suggestedCaptions" JSONB,
    "suggestedAssets" JSONB,
    "rawState" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    ,
    CONSTRAINT "editorial_drafts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "editorial_drafts_projectId_idx" ON public.editorial_drafts USING btree ("projectId");
CREATE INDEX IF NOT EXISTS editorial_drafts_status_idx ON public.editorial_drafts USING btree (status);

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'editorial_drafts_projectId_fkey') THEN
        ALTER TABLE "editorial_drafts" ADD CONSTRAINT "editorial_drafts_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
