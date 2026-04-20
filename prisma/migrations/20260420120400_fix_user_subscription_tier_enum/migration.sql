-- Convert users.subscriptionTier from TEXT to proper SubscriptionTier enum, and tighten
-- nullability to match schema.prisma.
--
-- Authored 2026-04-20 as part of Phase 5B Bucket 2.
--
-- users table has 17 rows at time of authoring, all with subscriptionTier='FREE', all
-- non-null. DROP DEFAULT required because 'FREE'::text default expression cannot auto-cast
-- during column type change. SET NOT NULL restores schema.prisma's declared non-nullability.
--
-- Differs from 5B.4 pattern by requiring DROP/SET DEFAULT bracketing around the cast and
-- explicit SET NOT NULL. No CHECK constraint to drop — users.subscriptionTier had no shadow
-- constraint.

DO $$ BEGIN
    CREATE TYPE "SubscriptionTier" AS ENUM ('FREE', 'PRO', 'STUDIO', 'ENTERPRISE');
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE "users" ALTER COLUMN "subscriptionTier" DROP DEFAULT;

ALTER TABLE "users"
  ALTER COLUMN "subscriptionTier" TYPE "SubscriptionTier" USING "subscriptionTier"::"SubscriptionTier";

ALTER TABLE "users" ALTER COLUMN "subscriptionTier" SET DEFAULT 'FREE';

ALTER TABLE "users" ALTER COLUMN "subscriptionTier" SET NOT NULL;
