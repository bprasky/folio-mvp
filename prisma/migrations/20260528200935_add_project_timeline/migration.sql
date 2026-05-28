-- Add ProjectTimeline enum + Project.timeline column.
-- Idempotent: enum creation guarded with DO $$ (duplicate_object), column added IF NOT EXISTS.
-- Nullable, no default — purely additive; existing rows are unaffected.

DO $$ BEGIN
  CREATE TYPE "ProjectTimeline" AS ENUM ('PAST', 'PRESENT', 'FUTURE');
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "timeline" "ProjectTimeline";
