-- AlterTable: Add optional designer profile fields (additive, non-destructive)
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "title" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "phone" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "studio" TEXT;



