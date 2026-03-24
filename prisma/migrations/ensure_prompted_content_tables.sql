-- Prompted Content System — ensure all enums, tables, and indexes exist
-- Safe to run multiple times (all statements use IF NOT EXISTS / DO blocks)

-- ============================================================
-- 1. Enums
-- ============================================================

DO $$ BEGIN
  CREATE TYPE "PromptedQuestionType" AS ENUM (
    'BIO_REFLECTIVE',
    'CROSS_DOMAIN',
    'PROJECT_REFLECTIVE',
    'PEER_RESONANT',
    'STORY_COMPLETING',
    'FOLLOW_UP'
  );
EXCEPTION WHEN duplicate_object THEN
  -- Enum exists; ensure all values are present
  BEGIN ALTER TYPE "PromptedQuestionType" ADD VALUE IF NOT EXISTS 'BIO_REFLECTIVE'; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER TYPE "PromptedQuestionType" ADD VALUE IF NOT EXISTS 'CROSS_DOMAIN'; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER TYPE "PromptedQuestionType" ADD VALUE IF NOT EXISTS 'PROJECT_REFLECTIVE'; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER TYPE "PromptedQuestionType" ADD VALUE IF NOT EXISTS 'PEER_RESONANT'; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER TYPE "PromptedQuestionType" ADD VALUE IF NOT EXISTS 'STORY_COMPLETING'; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER TYPE "PromptedQuestionType" ADD VALUE IF NOT EXISTS 'FOLLOW_UP'; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

DO $$ BEGIN
  CREATE TYPE "PromptedQuestionStatus" AS ENUM (
    'GENERATED',
    'DELIVERED',
    'ANSWERED',
    'SKIPPED',
    'EXPIRED'
  );
EXCEPTION WHEN duplicate_object THEN
  BEGIN ALTER TYPE "PromptedQuestionStatus" ADD VALUE IF NOT EXISTS 'GENERATED'; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER TYPE "PromptedQuestionStatus" ADD VALUE IF NOT EXISTS 'DELIVERED'; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER TYPE "PromptedQuestionStatus" ADD VALUE IF NOT EXISTS 'ANSWERED'; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER TYPE "PromptedQuestionStatus" ADD VALUE IF NOT EXISTS 'SKIPPED'; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER TYPE "PromptedQuestionStatus" ADD VALUE IF NOT EXISTS 'EXPIRED'; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

DO $$ BEGIN
  CREATE TYPE "StoryThreadStatus" AS ENUM (
    'FORMING',
    'MATURING',
    'READY',
    'PROPOSED',
    'PUBLISHED',
    'STALE'
  );
EXCEPTION WHEN duplicate_object THEN
  BEGIN ALTER TYPE "StoryThreadStatus" ADD VALUE IF NOT EXISTS 'FORMING'; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER TYPE "StoryThreadStatus" ADD VALUE IF NOT EXISTS 'MATURING'; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER TYPE "StoryThreadStatus" ADD VALUE IF NOT EXISTS 'READY'; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER TYPE "StoryThreadStatus" ADD VALUE IF NOT EXISTS 'PROPOSED'; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER TYPE "StoryThreadStatus" ADD VALUE IF NOT EXISTS 'PUBLISHED'; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER TYPE "StoryThreadStatus" ADD VALUE IF NOT EXISTS 'STALE'; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

-- Add PROMPTED_ARTICLE to PostVariant if missing
DO $$ BEGIN
  ALTER TYPE "PostVariant" ADD VALUE IF NOT EXISTS 'PROMPTED_ARTICLE';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 2. Tables
-- ============================================================

CREATE TABLE IF NOT EXISTS "prompted_questions" (
  "id"               TEXT NOT NULL PRIMARY KEY,
  "targetUserId"     TEXT NOT NULL,
  "questionText"     TEXT NOT NULL,
  "questionType"     "PromptedQuestionType" NOT NULL DEFAULT 'BIO_REFLECTIVE',
  "provenance"       JSONB NOT NULL,
  "atelierSignals"   JSONB,
  "priority"         DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  "deliveryContext"  TEXT NOT NULL DEFAULT 'feed_card',
  "deliveredAt"      TIMESTAMP(3),
  "expiresAt"        TIMESTAMP(3),
  "status"           "PromptedQuestionStatus" NOT NULL DEFAULT 'GENERATED',
  "parentAnswerId"   TEXT,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "prompted_questions_targetUserId_fkey"
    FOREIGN KEY ("targetUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
  -- parentAnswerId FK added after prompted_answers table is created (see below)
);

CREATE TABLE IF NOT EXISTS "prompted_answers" (
  "id"                TEXT NOT NULL PRIMARY KEY,
  "questionId"        TEXT NOT NULL,
  "userId"            TEXT NOT NULL,
  "answerText"        TEXT NOT NULL,
  "videoUrl"          TEXT,
  "transcriptRaw"     TEXT,
  "profileQAId"       TEXT,
  "bioEnriched"       BOOLEAN NOT NULL DEFAULT false,
  "consentToQuote"    BOOLEAN NOT NULL DEFAULT true,
  "storyThreadIds"    TEXT[] DEFAULT ARRAY[]::TEXT[],
  "pullQuoteExcerpt"  TEXT,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "prompted_answers_questionId_fkey"
    FOREIGN KEY ("questionId") REFERENCES "prompted_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "prompted_answers_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Now add the deferred FK from prompted_questions → prompted_answers
-- (couldn't add inline because prompted_answers didn't exist yet on first run)
DO $$ BEGIN
  ALTER TABLE "prompted_questions"
    ADD CONSTRAINT "prompted_questions_parentAnswerId_fkey"
    FOREIGN KEY ("parentAnswerId") REFERENCES "prompted_answers"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "story_threads" (
  "id"                    TEXT NOT NULL PRIMARY KEY,
  "status"                "StoryThreadStatus" NOT NULL DEFAULT 'FORMING',
  "themeDescription"      TEXT NOT NULL,
  "proposedAngle"         TEXT,
  "proposedTitle"         TEXT,
  "contributingAnswers"   JSONB NOT NULL,
  "supportingContext"     JSONB NOT NULL DEFAULT '[]',
  "narrativeTension"      DOUBLE PRECISION NOT NULL DEFAULT 0,
  "perspectiveDiversity"  DOUBLE PRECISION NOT NULL DEFAULT 0,
  "emotionalWeight"       DOUBLE PRECISION NOT NULL DEFAULT 0,
  "specificityScore"      DOUBLE PRECISION NOT NULL DEFAULT 0,
  "compositeScore"        DOUBLE PRECISION NOT NULL DEFAULT 0,
  "readyThresholds"       JSONB NOT NULL DEFAULT '{"minContributors": 3, "minTensionScore": 0.4, "minSpecificityScore": 0.5}',
  "articlePostId"         TEXT,
  "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastActivityAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "staleAfter"            TIMESTAMP(3) NOT NULL,

  CONSTRAINT "story_threads_articlePostId_fkey"
    FOREIGN KEY ("articlePostId") REFERENCES "project_posts"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- ============================================================
-- 3. Indexes
-- ============================================================

CREATE INDEX IF NOT EXISTS "prompted_questions_targetUserId_status_idx"
  ON "prompted_questions"("targetUserId", "status");

CREATE INDEX IF NOT EXISTS "prompted_questions_status_priority_idx"
  ON "prompted_questions"("status", "priority");

CREATE INDEX IF NOT EXISTS "prompted_answers_userId_idx"
  ON "prompted_answers"("userId");

CREATE INDEX IF NOT EXISTS "prompted_answers_questionId_idx"
  ON "prompted_answers"("questionId");

CREATE INDEX IF NOT EXISTS "story_threads_status_idx"
  ON "story_threads"("status");

CREATE INDEX IF NOT EXISTS "story_threads_compositeScore_idx"
  ON "story_threads"("compositeScore");
