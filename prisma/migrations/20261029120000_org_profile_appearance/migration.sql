-- Optional organization cover and page presentation. NULL uses Folio defaults.
-- Existing profile text, identity and organization membership remain unchanged.
ALTER TABLE "organizations"
  ADD COLUMN IF NOT EXISTS "profileAppearance" JSONB;
