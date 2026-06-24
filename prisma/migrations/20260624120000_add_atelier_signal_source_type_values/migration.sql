-- Record the AtelierSignalSourceType enum values that schema.prisma declares but
-- production is missing. The enum was redeclared in the schema
-- (PROJECT, SELECTION, SAVE, TAG, INTERVIEW, BEHAVIOR) without a matching
-- migration, so prod still has its original value set
-- (ONBOARDING, PROJECT, PROJECT_TAG, MOODBOARD, PRODUCT_TAG, EVENT, BEHAVIOR)
-- and rejects writes of 'TAG' / 'INTERVIEW' from the tagging + interview paths.
--
-- Additive and idempotent: ADD VALUE IF NOT EXISTS leaves existing rows and the
-- legacy values untouched (Postgres cannot drop enum values in place, and the
-- legacy values are harmless), and re-running this migration is a no-op.
ALTER TYPE "AtelierSignalSourceType" ADD VALUE IF NOT EXISTS 'SELECTION';
ALTER TYPE "AtelierSignalSourceType" ADD VALUE IF NOT EXISTS 'SAVE';
ALTER TYPE "AtelierSignalSourceType" ADD VALUE IF NOT EXISTS 'TAG';
ALTER TYPE "AtelierSignalSourceType" ADD VALUE IF NOT EXISTS 'INTERVIEW';
