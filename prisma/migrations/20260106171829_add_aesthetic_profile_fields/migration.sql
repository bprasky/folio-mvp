-- AlterTable
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "aestheticProfile" JSONB;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "aestheticDetectedAt" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "profileState" TEXT NOT NULL DEFAULT 'empty';

