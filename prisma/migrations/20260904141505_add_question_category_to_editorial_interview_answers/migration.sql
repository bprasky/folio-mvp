-- Add the question category to editorial_interview_answers.
--
-- ADD-ONLY. One nullable column, no default, no backfill, no change to any
-- existing column, no data written or moved. Every existing row keeps NULL,
-- which the loader reads as "unknown" rather than as a wrong value.
--
-- WHY. Provenance stores the question category as `section`. loadInterviewAnswers
-- overwrites `section` with the resolved room name, because that is what
-- quoteCandidates.ts:98 and selectPullQuotes.ts:173 match against a chapter
-- title. The projection had no column for the category, so it was dropped at
-- write time and unrecoverable at read time — and the reverse sync
-- (syncEditorialAnswersToProvenance) re-derived it with a 'how' fallback,
-- overwriting the canonical value with a guess. This column is where the
-- category goes so that the room and the topic stop sharing one field.
--
-- IF NOT EXISTS per the Phase 5E idempotency rule enforced by
-- scripts/phase5e-check-plan.mjs check 4.

ALTER TABLE "editorial_interview_answers"
  ADD COLUMN IF NOT EXISTS "question_category" TEXT;
