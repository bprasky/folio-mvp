-- Capture the auto-tagger's original guessed position on ProductTag so the
-- designer's drag corrections (x/y) can be compared against the AI's guess
-- (aiX/aiY) as training data. Nullable — manually-placed tags have no AI guess.
-- Idempotent: ADD COLUMN IF NOT EXISTS so re-running is a no-op.
ALTER TABLE "product_tags" ADD COLUMN IF NOT EXISTS "aiX" DOUBLE PRECISION;
ALTER TABLE "product_tags" ADD COLUMN IF NOT EXISTS "aiY" DOUBLE PRECISION;
