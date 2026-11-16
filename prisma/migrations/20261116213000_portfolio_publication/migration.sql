-- Additive only: existing publication intent and visibility are unchanged.
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "portfolioPublishedAt" TIMESTAMP(3);
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "portfolioCoverImageId" TEXT;
