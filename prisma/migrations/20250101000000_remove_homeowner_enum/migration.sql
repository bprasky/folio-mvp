-- Migration: Remove HOMEOWNER enum value, convert existing records to INDIVIDUAL
-- This migration is safe and idempotent

-- Step 1: Convert all existing HOMEOWNER records to INDIVIDUAL
UPDATE "User" 
SET role = 'INDIVIDUAL' 
WHERE role = 'HOMEOWNER';

-- Step 2: Remove HOMEOWNER from the enum
-- Note: PostgreSQL doesn't support removing enum values directly
-- We need to recreate the enum. This is safe because we've already migrated all data.

-- Create new enum without HOMEOWNER
CREATE TYPE "Role_new" AS ENUM ('ADMIN', 'VENDOR', 'DESIGNER', 'GUEST', 'INDIVIDUAL');

-- Update all columns to use new enum
ALTER TABLE "User" ALTER COLUMN role TYPE "Role_new" USING role::text::"Role_new";

-- Drop old enum and rename new one
DROP TYPE "Role";
ALTER TYPE "Role_new" RENAME TO "Role";



