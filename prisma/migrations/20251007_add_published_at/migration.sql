-- AlterTable: Add publishedAt field to Project (additive, non-destructive)
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "publishedAt" TIMESTAMP(3);

-- Optional: Backfill existing public projects with a publishedAt timestamp
-- UPDATE "projects" 
-- SET "publishedAt" = "createdAt" 
-- WHERE "isPublic" = true AND "publishedAt" IS NULL;




