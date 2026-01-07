-- Add AI classification fields to project_images table
ALTER TABLE "project_images" 
ADD COLUMN IF NOT EXISTS "ai_classification" JSONB,
ADD COLUMN IF NOT EXISTS "ai_classified_at" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "verified_attributes" JSONB,
ADD COLUMN IF NOT EXISTS "verified_at" TIMESTAMP(3);

-- Add index for querying by classification status
CREATE INDEX IF NOT EXISTS "project_images_ai_classified_at_idx" ON "project_images"("ai_classified_at");
CREATE INDEX IF NOT EXISTS "project_images_verified_at_idx" ON "project_images"("verified_at");

