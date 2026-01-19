-- Add legal consent tracking fields to users table
-- These fields track when users accepted Terms of Service and Privacy Policy

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "tosAcceptedAt" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "privacyAcceptedAt" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "tosVersion" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "privacyVersion" TEXT;
