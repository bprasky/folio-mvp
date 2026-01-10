-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'SUPPORT', 'CURATOR');

-- AlterTable
ALTER TABLE "users" ADD COLUMN "adminRole" "AdminRole";

-- Update existing ADMIN role users to have ADMIN adminRole
-- This preserves backward compatibility
UPDATE "users" SET "adminRole" = 'ADMIN' WHERE "role" = 'ADMIN';
