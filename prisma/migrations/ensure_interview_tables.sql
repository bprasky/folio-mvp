-- ============================================================
-- Migration: Ensure editorial_interviews + realtime_interview tables exist
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Check if editorial_interviews table already exists
-- If it errors on "already exists", that's fine — skip that section.

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
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "editorial_interviews_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "editorial_interviews_project_id_key"
  ON "editorial_interviews"("project_id");

ALTER TABLE "editorial_interviews"
  DROP CONSTRAINT IF EXISTS "editorial_interviews_project_id_fkey";
ALTER TABLE "editorial_interviews"
  ADD CONSTRAINT "editorial_interviews_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

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
    "linked_image_id" TEXT,
    "linked_product_id" TEXT,
    "question_source" TEXT,
    "ai_classification_attribute" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "editorial_interview_answers_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "editorial_interview_answers_interview_id_idx"
  ON "editorial_interview_answers"("interview_id");
CREATE INDEX IF NOT EXISTS "editorial_interview_answers_question_id_idx"
  ON "editorial_interview_answers"("question_id");
CREATE INDEX IF NOT EXISTS "editorial_interview_answers_linked_image_id_idx"
  ON "editorial_interview_answers"("linked_image_id");

ALTER TABLE "editorial_interview_answers"
  DROP CONSTRAINT IF EXISTS "editorial_interview_answers_interview_id_fkey";
ALTER TABLE "editorial_interview_answers"
  ADD CONSTRAINT "editorial_interview_answers_interview_id_fkey"
  FOREIGN KEY ("interview_id") REFERENCES "editorial_interviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

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


-- ============================================================
-- 2. Realtime Interview Session tables (for "Have a conversation" feature)
-- ============================================================

DO $$ BEGIN
  CREATE TYPE "RealtimeSessionStatus" AS ENUM ('ACTIVE', 'PAUSED', 'COMPLETED', 'ABANDONED', 'FAILED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "realtime_interview_sessions" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "editorial_interview_id" TEXT,
    "status" "RealtimeSessionStatus" NOT NULL DEFAULT 'ACTIVE',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMP(3),
    "total_duration_ms" INTEGER,
    "project_context" JSONB,
    "conversation_summary" TEXT,
    "turn_count" INTEGER NOT NULL DEFAULT 0,
    "extracted_quotes" JSONB,
    "extracted_products" JSONB,
    "extracted_themes" JSONB,
    "extracted_decisions" JSONB,
    "livekit_room_name" TEXT,
    "livekit_room_id" TEXT,
    "avg_transcript_confidence" DOUBLE PRECISION,
    "designer_speaking_ratio" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "realtime_interview_sessions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "realtime_interview_sessions_project_id_idx"
  ON "realtime_interview_sessions"("project_id");
CREATE INDEX IF NOT EXISTS "realtime_interview_sessions_status_idx"
  ON "realtime_interview_sessions"("status");
CREATE UNIQUE INDEX IF NOT EXISTS "realtime_interview_sessions_livekit_room_name_key"
  ON "realtime_interview_sessions"("livekit_room_name");

ALTER TABLE "realtime_interview_sessions"
  DROP CONSTRAINT IF EXISTS "realtime_interview_sessions_project_id_fkey";
ALTER TABLE "realtime_interview_sessions"
  ADD CONSTRAINT "realtime_interview_sessions_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "realtime_interview_sessions"
  DROP CONSTRAINT IF EXISTS "realtime_interview_sessions_editorial_interview_id_fkey";
ALTER TABLE "realtime_interview_sessions"
  ADD CONSTRAINT "realtime_interview_sessions_editorial_interview_id_fkey"
  FOREIGN KEY ("editorial_interview_id") REFERENCES "editorial_interviews"("id");

CREATE TABLE IF NOT EXISTS "realtime_conversation_segments" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "sequence_number" INTEGER NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "audio_url" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL,
    "ended_at" TIMESTAMP(3),
    "duration_ms" INTEGER,
    "transcript_confidence" DOUBLE PRECISION,
    "transcript_raw" TEXT,
    "prompt_tokens" INTEGER,
    "response_tokens" INTEGER,
    "latency_ms" INTEGER,
    "extracted_quote" TEXT,
    "extracted_products" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "extracted_mood" TEXT,
    "linked_question_id" TEXT,
    "linked_image_ids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "linked_product_ids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "linked_room_name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "realtime_conversation_segments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "realtime_conversation_segments_session_id_sequence_number_key"
  ON "realtime_conversation_segments"("session_id", "sequence_number");
CREATE INDEX IF NOT EXISTS "realtime_conversation_segments_session_id_started_at_idx"
  ON "realtime_conversation_segments"("session_id", "started_at");

ALTER TABLE "realtime_conversation_segments"
  DROP CONSTRAINT IF EXISTS "realtime_conversation_segments_session_id_fkey";
ALTER TABLE "realtime_conversation_segments"
  ADD CONSTRAINT "realtime_conversation_segments_session_id_fkey"
  FOREIGN KEY ("session_id") REFERENCES "realtime_interview_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================
-- Done! Verify with:
-- SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE '%interview%';
-- ============================================================
