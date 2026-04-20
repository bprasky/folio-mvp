-- Convert conversations.category, pending_actions.actionType, and pending_actions.status
-- from TEXT to their proper enum types (MessageCategory + PendingActionStatus).
--
-- Authored 2026-04-20 as final Phase 5B Bucket 2 item.
--
-- Three column conversions bundled into one migration because Conversation.category and
-- PendingAction.actionType share the MessageCategory enum. PendingAction.status uses a
-- separate PendingActionStatus enum. Both enums require CREATE TYPE.
--
-- All three tables are empty at time of authoring — cast is pure metadata, zero rows to
-- convert. All three columns already NOT NULL, matching schema.prisma. Two of three
-- columns have defaults requiring DROP DEFAULT / SET DEFAULT bracketing per the
-- bucket2_drop_set_default_pattern memory.
--
-- Statement ordering: both CREATE TYPEs first (no inter-table dependency), then column
-- conversions grouped by table for readability.

-- Part 1: Create both enum types

DO $$ BEGIN
    CREATE TYPE "MessageCategory" AS ENUM ('SAMPLE_REQUEST', 'QUOTE_REQUEST', 'REORDER_REQUEST', 'COLLABORATION', 'GENERAL');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE "PendingActionStatus" AS ENUM ('PENDING', 'DELIVERED', 'EXPIRED', 'CANCELLED', 'EMAIL_SENT');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Part 2: conversations.category (has default — DROP/SET DEFAULT bracket)

ALTER TABLE "conversations" ALTER COLUMN "category" DROP DEFAULT;

ALTER TABLE "conversations"
  ALTER COLUMN "category" TYPE "MessageCategory" USING "category"::"MessageCategory";

ALTER TABLE "conversations" ALTER COLUMN "category" SET DEFAULT 'GENERAL';

-- Part 3: pending_actions.actionType (no default — simple cast)

ALTER TABLE "pending_actions"
  ALTER COLUMN "actionType" TYPE "MessageCategory" USING "actionType"::"MessageCategory";

-- Part 4: pending_actions.status (has default — DROP/SET DEFAULT bracket)

ALTER TABLE "pending_actions" ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "pending_actions"
  ALTER COLUMN "status" TYPE "PendingActionStatus" USING "status"::"PendingActionStatus";

ALTER TABLE "pending_actions" ALTER COLUMN "status" SET DEFAULT 'PENDING';
