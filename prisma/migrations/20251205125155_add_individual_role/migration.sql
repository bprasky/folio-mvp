-- AlterEnum: Add INDIVIDUAL role (additive, non-destructive)
-- This migration adds the INDIVIDUAL value to the Role enum.
-- Using a DO block to safely check if the value already exists before adding it.

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'INDIVIDUAL' 
        AND enumtypid = (
            SELECT oid FROM pg_type WHERE typname = 'Role'
        )
    ) THEN
        ALTER TYPE "Role" ADD VALUE 'INDIVIDUAL';
    END IF;
END $$;




