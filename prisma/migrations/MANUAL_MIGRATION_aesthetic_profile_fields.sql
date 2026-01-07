-- ============================================================
-- Manual Migration: Add Aesthetic Profile Fields to Users
-- ============================================================
-- Run this SQL manually if Prisma migrations are blocked
-- Date: 2026-01-06
-- ============================================================

-- Add aestheticProfile column (JSONB, nullable)
ALTER TABLE "users" 
ADD COLUMN IF NOT EXISTS "aestheticProfile" JSONB;

-- Add aestheticDetectedAt column (timestamp, nullable)
ALTER TABLE "users" 
ADD COLUMN IF NOT EXISTS "aestheticDetectedAt" TIMESTAMP(3);

-- Add profileState column (TEXT, NOT NULL with default)
-- Note: For existing rows, we set default value first, then add NOT NULL constraint
DO $$
BEGIN
    -- Add column as nullable first
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'profileState'
    ) THEN
        ALTER TABLE "users" ADD COLUMN "profileState" TEXT;
        
        -- Set default value for existing rows
        UPDATE "users" SET "profileState" = 'empty' WHERE "profileState" IS NULL;
        
        -- Now add NOT NULL constraint with default
        ALTER TABLE "users" 
        ALTER COLUMN "profileState" SET DEFAULT 'empty',
        ALTER COLUMN "profileState" SET NOT NULL;
    END IF;
END $$;

-- Verification query (run this to confirm columns were added)
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'users' 
  AND column_name IN ('aestheticProfile', 'aestheticDetectedAt', 'profileState')
ORDER BY column_name;

