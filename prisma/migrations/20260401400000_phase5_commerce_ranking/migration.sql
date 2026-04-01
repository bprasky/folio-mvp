-- Phase 5: Commerce + Ranking
-- Add per-category notification preferences to messaging_preferences

ALTER TABLE "messaging_preferences" ADD COLUMN IF NOT EXISTS "emailOnSampleRequest" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "messaging_preferences" ADD COLUMN IF NOT EXISTS "emailOnQuoteRequest" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "messaging_preferences" ADD COLUMN IF NOT EXISTS "emailOnReorderRequest" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "messaging_preferences" ADD COLUMN IF NOT EXISTS "emailOnCollaboration" BOOLEAN NOT NULL DEFAULT true;
