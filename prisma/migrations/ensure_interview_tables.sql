-- ============================================================
-- Migration: Ensure editorial_interviews + realtime_interview tables exist
-- Run this in Supabase SQL Editor
--
-- NOTE: Prisma uses camelCase column names by default (no @map directives).
-- If tables were created via `prisma db push`, columns are camelCase.
-- ============================================================

-- 1. Editorial Interview tables
-- ============================================================

-- Create enum (if not exists)
DO $$ BEGIN
  CREATE TYPE "EditorialInterviewStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'PUBLISHED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Create editorial_interviews (if not exists)
CREATE TABLE IF NOT EXISTS "editorial_interviews" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "status" "EditorialInterviewStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "selectedQuestionIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "editorial_interviews_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "editorial_interviews_projectId_key"
  ON "editorial_interviews"("projectId");

ALTER TABLE "editorial_interviews"
  DROP CONSTRAINT IF EXISTS "editorial_interviews_projectId_fkey";
ALTER TABLE "editorial_interviews"
  ADD CONSTRAINT "editorial_interviews_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create editorial_interview_answers (if not exists)
CREATE TABLE IF NOT EXISTS "editorial_interview_answers" (
    "id" TEXT NOT NULL,
    "interviewId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "isFollowUp" BOOLEAN NOT NULL DEFAULT false,
    "parentAnswerId" TEXT,
    "answerText" TEXT NOT NULL,
    "audioUrl" TEXT,
    "inputModality" TEXT NOT NULL DEFAULT 'text',
    "confidenceScore" DOUBLE PRECISION,
    "inferredPriorities" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "softConstraints" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "linkedImageId" TEXT,
    "linkedProductId" TEXT,
    "questionSource" TEXT,
    "aiClassificationAttribute" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "editorial_interview_answers_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "editorial_interview_answers_interviewId_idx"
  ON "editorial_interview_answers"("interviewId");
CREATE INDEX IF NOT EXISTS "editorial_interview_answers_questionId_idx"
  ON "editorial_interview_answers"("questionId");
CREATE INDEX IF NOT EXISTS "editorial_interview_answers_linkedImageId_idx"
  ON "editorial_interview_answers"("linkedImageId");

ALTER TABLE "editorial_interview_answers"
  DROP CONSTRAINT IF EXISTS "editorial_interview_answers_interviewId_fkey";
ALTER TABLE "editorial_interview_answers"
  ADD CONSTRAINT "editorial_interview_answers_interviewId_fkey"
  FOREIGN KEY ("interviewId") REFERENCES "editorial_interviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add columns that may be missing from original migration
DO $$ BEGIN
  ALTER TABLE "editorial_interview_answers" ADD COLUMN "linkedImageId" TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "editorial_interview_answers" ADD COLUMN "linkedProductId" TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "editorial_interview_answers" ADD COLUMN "questionSource" TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "editorial_interview_answers" ADD COLUMN "aiClassificationAttribute" TEXT;
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

CREATE INDEX IF NOT EXISTS "realtime_interview_sessions_projectId_idx"
  ON "realtime_interview_sessions"("projectId");
CREATE INDEX IF NOT EXISTS "realtime_interview_sessions_status_idx"
  ON "realtime_interview_sessions"("status");
CREATE UNIQUE INDEX IF NOT EXISTS "realtime_interview_sessions_livekitRoomName_key"
  ON "realtime_interview_sessions"("livekitRoomName");

ALTER TABLE "realtime_interview_sessions"
  DROP CONSTRAINT IF EXISTS "realtime_interview_sessions_projectId_fkey";
ALTER TABLE "realtime_interview_sessions"
  ADD CONSTRAINT "realtime_interview_sessions_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "realtime_interview_sessions"
  DROP CONSTRAINT IF EXISTS "realtime_interview_sessions_editorialInterviewId_fkey";
ALTER TABLE "realtime_interview_sessions"
  ADD CONSTRAINT "realtime_interview_sessions_editorialInterviewId_fkey"
  FOREIGN KEY ("editorialInterviewId") REFERENCES "editorial_interviews"("id");

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

CREATE UNIQUE INDEX IF NOT EXISTS "realtime_conversation_segments_sessionId_sequenceNumber_key"
  ON "realtime_conversation_segments"("sessionId", "sequenceNumber");
CREATE INDEX IF NOT EXISTS "realtime_conversation_segments_sessionId_startedAt_idx"
  ON "realtime_conversation_segments"("sessionId", "startedAt");

ALTER TABLE "realtime_conversation_segments"
  DROP CONSTRAINT IF EXISTS "realtime_conversation_segments_sessionId_fkey";
ALTER TABLE "realtime_conversation_segments"
  ADD CONSTRAINT "realtime_conversation_segments_sessionId_fkey"
  FOREIGN KEY ("sessionId") REFERENCES "realtime_interview_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================
-- Done! Verify with:
-- SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE '%interview%';
-- ============================================================
