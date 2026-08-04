-- EditorialInterviewAnswer.wordTimings — Whisper word-level timings for the
-- retained recording, projected from provenance.interview.audio (spec 21 delta D5a).
--
-- Additive and idempotent. Nullable, no default, no backfill: rows predating
-- audio retention have no recording and therefore no timings, and NULL is the
-- correct statement of that rather than an empty array standing in for one.
--
-- No index. Nothing queries BY timing content — the column is read once an
-- answer is already selected. If film-eligibility filtering later needs one,
-- `WHERE word_timings IS NOT NULL` is the predicate and a partial index is the
-- follow-up.
--
-- Column existence verified against prod information_schema before authoring:
-- editorial_interview_answers held audio_url (text, nullable) and no word_timings.

ALTER TABLE "editorial_interview_answers"
  ADD COLUMN IF NOT EXISTS "word_timings" JSONB;
