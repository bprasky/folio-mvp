-- Add Designer Attribution & Compensation System fields to users table
-- These fields support the compensation and attribution system

-- Add vendorVisibility field (default false)
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "vendorVisibility" BOOLEAN NOT NULL DEFAULT false;

-- Add vendorVisibilityEnabledAt field (optional timestamp)
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "vendorVisibilityEnabledAt" TIMESTAMP(3);

-- Add influenceScore field (optional float 0-100)
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "influenceScore" DOUBLE PRECISION;

-- Add influenceScoreUpdatedAt field (optional timestamp)
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "influenceScoreUpdatedAt" TIMESTAMP(3);

-- Add folioCreditBalance field (decimal with default 0)
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "folioCreditBalance" DECIMAL(10, 2) NOT NULL DEFAULT 0;

-- Create index on vendorVisibility for efficient vendor queries
CREATE INDEX IF NOT EXISTS "users_vendorVisibility_idx" ON "users"("vendorVisibility");

-- Create index on influenceScore for ranking queries
CREATE INDEX IF NOT EXISTS "users_influenceScore_idx" ON "users"("influenceScore");
