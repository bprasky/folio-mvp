-- Create attribute_verifications table for training data
CREATE TABLE IF NOT EXISTS "attribute_verifications" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "project_id" TEXT NOT NULL,
  "image_id" TEXT,
  "attribute_type" TEXT NOT NULL,
  "ai_value" TEXT NOT NULL,
  "verified" BOOLEAN,
  "corrected_value" TEXT,
  "question_asked" TEXT NOT NULL,
  "designer_response" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT "attribute_verifications_project_id_fkey" 
    FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "attribute_verifications_image_id_fkey" 
    FOREIGN KEY ("image_id") REFERENCES "project_images"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS "attribute_verifications_attribute_type_verified_idx" 
  ON "attribute_verifications"("attribute_type", "verified");
CREATE INDEX IF NOT EXISTS "attribute_verifications_project_id_idx" 
  ON "attribute_verifications"("project_id");
CREATE INDEX IF NOT EXISTS "attribute_verifications_image_id_idx" 
  ON "attribute_verifications"("image_id");

