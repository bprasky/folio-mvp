-- Convert organizations.vendorTier from TEXT to proper VendorTier enum.
--
-- Authored 2026-04-20 as part of Phase 5B Bucket 2.
--
-- Simplest Bucket 2 item: VendorTier type already existed in prod from a prior hand-SQL
-- path; organizations has 2 rows with NULL vendorTier, so the cast is a pure metadata
-- change with no data conversion.
--
-- Statement 1 (CREATE TYPE) is idempotent via duplicate_object guard and retained only
-- for fresh-DB replay correctness; against current prod it no-ops. Statement 2 performs
-- the column type change.
--
-- Schema.prisma declares vendorTier as nullable (VendorTier?) — prod column is already
-- nullable, so no SET NOT NULL needed. No default to bracket, no CHECK to drop.

DO $$ BEGIN
    CREATE TYPE "VendorTier" AS ENUM ('STARTER', 'GROWTH', 'PROFESSIONAL', 'ENTERPRISE');
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE "organizations"
  ALTER COLUMN "vendorTier" TYPE "VendorTier" USING "vendorTier"::"VendorTier";
