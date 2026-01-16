-- Migration: Add ARCHITECT and BUILDER user types
-- This is an ADD-only migration - no existing enum values are removed or renamed

-- ============================================================
-- Step 1: Add new Role enum values
-- ============================================================

-- Add HOMEOWNER back for backward compatibility (was removed previously)
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'HOMEOWNER';

-- Add ARCHITECT role (parallel to DESIGNER)
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'ARCHITECT';

-- Add BUILDER role (parallel to DESIGNER)
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'BUILDER';

-- ============================================================
-- Step 2: Add ARCHITECTURE_FIRM to OrgType enum
-- ============================================================

ALTER TYPE "OrgType" ADD VALUE IF NOT EXISTS 'ARCHITECTURE_FIRM';

-- ============================================================
-- Step 3: Add ARCHITECT and BUILDER to ParticipantSide enum
-- ============================================================

ALTER TYPE "ParticipantSide" ADD VALUE IF NOT EXISTS 'ARCHITECT';
ALTER TYPE "ParticipantSide" ADD VALUE IF NOT EXISTS 'BUILDER';

-- ============================================================
-- Step 4: Add architect-specific profile columns to users table
-- ============================================================

-- Architect license number (e.g., "CA-12345")
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "architectLicenseNumber" TEXT;

-- States where architect is licensed (e.g., ["CA", "NY", "TX"])
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "architectLicensedStates" TEXT[] DEFAULT '{}';

-- Project scale preferences (e.g., ["residential", "commercial", "institutional"])
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "architectProjectScale" TEXT[] DEFAULT '{}';

-- Specializations (e.g., ["adaptive_reuse", "ground_up", "historic_preservation"])
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "architectSpecializations" TEXT[] DEFAULT '{}';

-- ============================================================
-- Step 5: Add builder-specific profile columns to users table
-- ============================================================

-- Project types (e.g., ["custom_homes", "renovations", "commercial_ti"])
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "builderProjectTypes" TEXT[] DEFAULT '{}';

-- Square footage range (e.g., "5000-25000" or "25000+")
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "builderSquareFootageRange" TEXT;

-- Specialty trades (e.g., ["millwork", "steel", "concrete", "glass"])
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "builderSpecialtyTrades" TEXT[] DEFAULT '{}';

-- Years in business
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "builderYearsInBusiness" INTEGER;
