-- ============================================================
-- Migration: Ensure editorial_interviews + realtime_interview tables exist
-- Run this in Supabase SQL Editor
--
-- NOTE: editorial tables have snake_case columns (created by manual SQL migration).
--       realtime tables have camelCase columns (created by prisma db push).
-- ============================================================

-- 1. Editorial Interview tables (snake_case columns)
-- ============================================================

-- Create enum (if not exists)
DO $$ BEGIN
  CREATE TYPE "EditorialInterviewStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'PUBLISHED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Create editorial_interviews (if not exists)
CREATE TABLE IF NOT EXISTS "editorial_interviews" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "status" "EditorialInterviewStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "selected_question_ids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "editorial_interviews_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  CREATE UNIQUE INDEX "editorial_interviews_project_id_key" ON "editorial_interviews"("project_id");
EXCEPTION WHEN duplicate_table THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "editorial_interviews"
    ADD CONSTRAINT "editorial_interviews_project_id_fkey"
    FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Create editorial_interview_answers (if not exists)
CREATE TABLE IF NOT EXISTS "editorial_interview_answers" (
    "id" TEXT NOT NULL,
    "interview_id" TEXT NOT NULL,
    "question_id" TEXT NOT NULL,
    "is_follow_up" BOOLEAN NOT NULL DEFAULT false,
    "parent_answer_id" TEXT,
    "answer_text" TEXT NOT NULL,
    "audio_url" TEXT,
    "input_modality" TEXT NOT NULL DEFAULT 'text',
    "confidence_score" DOUBLE PRECISION,
    "inferred_priorities" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "soft_constraints" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "editorial_interview_answers_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  CREATE INDEX "editorial_interview_answers_interview_id_idx" ON "editorial_interview_answers"("interview_id");
EXCEPTION WHEN duplicate_table THEN NULL;
END $$;

DO $$ BEGIN
  CREATE INDEX "editorial_interview_answers_question_id_idx" ON "editorial_interview_answers"("question_id");
EXCEPTION WHEN duplicate_table THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "editorial_interview_answers"
    ADD CONSTRAINT "editorial_interview_answers_interview_id_fkey"
    FOREIGN KEY ("interview_id") REFERENCES "editorial_interviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Add columns that may be missing from original migration
DO $$ BEGIN
  ALTER TABLE "editorial_interview_answers" ADD COLUMN "linked_image_id" TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "editorial_interview_answers" ADD COLUMN "linked_product_id" TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "editorial_interview_answers" ADD COLUMN "question_source" TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "editorial_interview_answers" ADD COLUMN "ai_classification_attribute" TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  CREATE INDEX "editorial_interview_answers_linked_image_id_idx" ON "editorial_interview_answers"("linked_image_id");
EXCEPTION WHEN duplicate_table THEN NULL;
END $$;


-- ============================================================
-- 2. Realtime Interview Session tables (camelCase columns, from prisma db push)
-- ============================================================

DO $$ BEGIN
  CREATE TYPE "RealtimeSessionStatus" AS ENUM ('ACTIVE', 'PAUSED', 'COMPLETED', 'ABANDONED', 'FAILED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "realtime_interview_sessions" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "editorialInterviewId" TEXT,
    "status" "RealtimeSessionStatus" NOT NULL DEFAULT 'ACTIVE',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "totalDurationMs" INTEGER,
    "projectContext" JSONB,
    "conversationSummary" TEXT,
    "turnCount" INTEGER NOT NULL DEFAULT 0,
    "extractedQuotes" JSONB,
    "extractedProducts" JSONB,
    "extractedThemes" JSONB,
    "extractedDecisions" JSONB,
    "livekitRoomName" TEXT,
    "livekitRoomId" TEXT,
    "avgTranscriptConfidence" DOUBLE PRECISION,
    "designerSpeakingRatio" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "realtime_interview_sessions_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  CREATE INDEX "realtime_interview_sessions_projectId_idx" ON "realtime_interview_sessions"("projectId");
EXCEPTION WHEN duplicate_table THEN NULL;
END $$;

DO $$ BEGIN
  CREATE INDEX "realtime_interview_sessions_status_idx" ON "realtime_interview_sessions"("status");
EXCEPTION WHEN duplicate_table THEN NULL;
END $$;

DO $$ BEGIN
  CREATE UNIQUE INDEX "realtime_interview_sessions_livekitRoomName_key" ON "realtime_interview_sessions"("livekitRoomName");
EXCEPTION WHEN duplicate_table THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "realtime_interview_sessions"
    ADD CONSTRAINT "realtime_interview_sessions_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "realtime_interview_sessions"
    ADD CONSTRAINT "realtime_interview_sessions_editorialInterviewId_fkey"
    FOREIGN KEY ("editorialInterviewId") REFERENCES "editorial_interviews"("id");
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "realtime_conversation_segments" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "sequenceNumber" INTEGER NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "audioUrl" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "transcriptConfidence" DOUBLE PRECISION,
    "transcriptRaw" TEXT,
    "promptTokens" INTEGER,
    "responseTokens" INTEGER,
    "latencyMs" INTEGER,
    "extractedQuote" TEXT,
    "extractedProducts" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "extractedMood" TEXT,
    "linkedQuestionId" TEXT,
    "linkedImageIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "linkedProductIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "linkedRoomName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "realtime_conversation_segments_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  CREATE UNIQUE INDEX "realtime_conversation_segments_sessionId_sequenceNumber_key" ON "realtime_conversation_segments"("sessionId", "sequenceNumber");
EXCEPTION WHEN duplicate_table THEN NULL;
END $$;

DO $$ BEGIN
  CREATE INDEX "realtime_conversation_segments_sessionId_startedAt_idx" ON "realtime_conversation_segments"("sessionId", "startedAt");
EXCEPTION WHEN duplicate_table THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "realtime_conversation_segments"
    ADD CONSTRAINT "realtime_conversation_segments_sessionId_fkey"
    FOREIGN KEY ("sessionId") REFERENCES "realtime_interview_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- Done! Verify with:
-- SELECT table_name, column_name FROM information_schema.columns
--   WHERE table_schema = 'public' AND table_name LIKE '%interview%'
--   ORDER BY table_name, ordinal_position;
-- ============================================================
