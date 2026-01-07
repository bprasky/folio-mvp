-- Fix NULL values in MomentIndex fields
-- This migration fixes existing records that have NULL values in non-nullable fields

-- Fix NULL combinedTags (set to empty array)
UPDATE "moment_index"
SET "combinedTags" = ARRAY[]::TEXT[]
WHERE "combinedTags" IS NULL;

-- Fix NULL searchText (set to empty string)
UPDATE "moment_index"
SET "searchText" = ''
WHERE "searchText" IS NULL;

-- Verify no NULLs remain
-- SELECT COUNT(*) FROM "moment_index" WHERE "combinedTags" IS NULL;
-- SELECT COUNT(*) FROM "moment_index" WHERE "searchText" IS NULL;

