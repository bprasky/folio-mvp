-- Backfill every users column that schema.prisma declares but no prior migration created.
-- Several columns lived only in loose root .sql files (e.g. add_designer_attribution_fields.sql),
-- which Prisma's migration engine never executes. Others were added to the schema directly
-- with no migration at all. Every signup hits a SELECT-all-scalar findFirst() on `users`, so any
-- missing column produces P2022 and blocks account creation.
--
-- All DDL is idempotent (IF NOT EXISTS / DO $$ guards). Safe to re-run; columns/enums that
-- already exist are skipped. Shadow-DB replay succeeds the same way.

-- Enum: BadgeLevel (referenced by users.contributorLevel)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'BadgeLevel') THEN
        CREATE TYPE "BadgeLevel" AS ENUM (
            'VOICE',
            'PERSPECTIVE',
            'SPECIALIST',
            'ENGAGED',
            'AUTHORITY',
            'EDITORIAL_VOICE'
        );
    END IF;
END $$;

-- Designer onboarding tracking
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "onboardingBrandStepCompletedAt" TIMESTAMP(3);

-- Photographer-specific profile fields
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "photographyStyles" TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "travelRadius"      TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "bookingEmail"      TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "bookingUrl"        TEXT;

-- Workspace context (null = operating as individual)
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "operatingAsOrgId" TEXT;

-- Directory & Subscription
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "subscriptionExpiresAt" TIMESTAMP(3);

-- Designer Attribution & Compensation System (was in loose add_designer_attribution_fields.sql, never applied)
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "vendorVisibility"          BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "vendorVisibilityEnabledAt" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "influenceScore"            DOUBLE PRECISION;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "influenceScoreUpdatedAt"   TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "folioCreditBalance"        DECIMAL(10, 2) NOT NULL DEFAULT 0;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "stripeConnectAccountId"    TEXT;

-- Contributor / Voice System
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "contributionCount"          INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "publishedContributionCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "contributorLevel"           "BadgeLevel";

-- Indexes that the loose attribution file would have created
CREATE INDEX IF NOT EXISTS "users_vendorVisibility_idx" ON "users" ("vendorVisibility");
CREATE INDEX IF NOT EXISTS "users_influenceScore_idx"   ON "users" ("influenceScore");
