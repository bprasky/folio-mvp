-- ============================================================
-- FIX: Add missing question_text column to editorial_interview_answers
--
-- The Prisma schema expects this column but it was never created.
-- This causes ALL answer inserts to fail with a 500 error, which
-- is why no interview answers are being saved to the database.
--
-- Run this in Supabase SQL Editor immediately.
-- ============================================================

DO $$ BEGIN
  ALTER TABLE "editorial_interview_answers" ADD COLUMN "question_text" TEXT;
  RAISE NOTICE 'Added question_text column to editorial_interview_answers';
EXCEPTION WHEN duplicate_column THEN
  RAISE NOTICE 'question_text column already exists — no action needed';
END $$;

-- Verify the column exists:
-- SELECT column_name, data_type FROM information_schema.columns
--   WHERE table_name = 'editorial_interview_answers' AND column_name = 'question_text';
