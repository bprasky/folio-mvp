-- Convert project_participants.role from TEXT+CHECK shadow to proper ParticipantRole enum.
-- Authored 2026-04-20 as part of Phase 5B Bucket 2. Mirrors the ParticipantSide fix pattern
-- from 20260115999999. All 5 existing rows cast cleanly from 'OWNER' TEXT to
-- ParticipantRole::OWNER. schema.prisma enum declares OWNER/EDITOR/VIEWER; prod column had
-- the same set enforced via project_participants_role_check rather than an enum type.
--
-- Safe: at time of authoring, project_participants has 5 rows, all role='OWNER'. The
-- USING "role"::"ParticipantRole" cast succeeds because 'OWNER' is a declared enum value.
-- If run against a DB where role contains values outside the enum, the cast fails
-- intentionally.

DO $$ BEGIN
    CREATE TYPE "ParticipantRole" AS ENUM ('OWNER', 'EDITOR', 'VIEWER');
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE "project_participants" DROP CONSTRAINT IF EXISTS "project_participants_role_check";

ALTER TABLE "project_participants"
  ALTER COLUMN "role" TYPE "ParticipantRole" USING "role"::"ParticipantRole";
