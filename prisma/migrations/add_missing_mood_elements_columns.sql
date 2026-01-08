-- Migration: Add Missing mood and elements Columns to MomentIndex
-- Description: Adds the mood and elements columns that were missing from the original searchable fields migration
-- Date: 2026-01-08
--
-- Run this migration if you're seeing errors like:
-- "The column `moment_index.mood` does not exist in the current database."
--
-- This migration is idempotent - it can be run multiple times safely.

-- ============================================================
-- 1. Add missing columns
-- ============================================================

ALTER TABLE "moment_index"
ADD COLUMN IF NOT EXISTS "mood" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN IF NOT EXISTS "elements" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- ============================================================
-- 2. Create indexes for performance
-- ============================================================

CREATE INDEX IF NOT EXISTS "moment_index_mood_idx"
ON "moment_index" USING GIN ("mood");

CREATE INDEX IF NOT EXISTS "moment_index_elements_idx"
ON "moment_index" USING GIN ("elements");

-- ============================================================
-- 3. Add column comments
-- ============================================================

COMMENT ON COLUMN "moment_index"."mood" IS 'Array of detected moods (e.g., ["airy", "moody", "warm", "dramatic"])';
COMMENT ON COLUMN "moment_index"."elements" IS 'Array of detected design elements (e.g., ["pendant lighting", "kitchen island", "built-ins"])';
