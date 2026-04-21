-- Phase 5H2: record existing meeting_notes in migration history.
-- Table was created hand-managed prior to reliable migration system.
-- CREATE TABLE IF NOT EXISTS for idempotency — prod is untouched; shadow DB gets the table on replay.
-- Column types lifted from information_schema.columns against prod (2026-04-21).

CREATE TABLE IF NOT EXISTS "meeting_notes" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "title" TEXT,
    "rawText" TEXT,
    "transcriptUrl" TEXT,
    "metadata" JSONB,
    "status" TEXT NOT NULL DEFAULT 'ready'::text,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    ,
    CONSTRAINT "meeting_notes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "meeting_notes_createdAt_idx" ON public.meeting_notes USING btree ("createdAt");
CREATE INDEX IF NOT EXISTS "meeting_notes_projectId_idx" ON public.meeting_notes USING btree ("projectId");

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'meeting_notes_projectId_fkey') THEN
        ALTER TABLE "meeting_notes" ADD CONSTRAINT "meeting_notes_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
