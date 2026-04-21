-- Phase 5H2: record existing room_intents in migration history.
-- Table was created hand-managed prior to reliable migration system.
-- CREATE TABLE IF NOT EXISTS for idempotency — prod is untouched; shadow DB gets the table on replay.
-- Column types lifted from information_schema.columns against prod (2026-04-21).

CREATE TABLE IF NOT EXISTS "room_intents" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "roomId" TEXT,
    "roomName" TEXT NOT NULL,
    "moodKeywords" TEXT[] DEFAULT ARRAY[]::text[],
    "palette" JSONB,
    "functionalGoals" JSONB,
    "mustHaves" JSONB,
    "niceToHaves" JSONB,
    "constraints" JSONB,
    "optionPolicyOverride" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    ,
    CONSTRAINT "room_intents_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "room_intents_projectId_idx" ON public.room_intents USING btree ("projectId");
CREATE INDEX IF NOT EXISTS "room_intents_roomId_idx" ON public.room_intents USING btree ("roomId");

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'room_intents_projectId_fkey') THEN
        ALTER TABLE "room_intents" ADD CONSTRAINT "room_intents_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
