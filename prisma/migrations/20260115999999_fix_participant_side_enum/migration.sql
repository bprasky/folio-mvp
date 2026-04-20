-- Fix pre-existing drift: ParticipantSide enum was declared in schema.prisma but never
-- created in prod. project_participants.side was created as TEXT with a CHECK constraint
-- restricting values to ('DESIGNER', 'VENDOR'). This migration creates the enum (with all
-- 4 schema.prisma values), drops the now-redundant (and Deploy-#2-blocking) CHECK
-- constraint, and converts the column.
--
-- Safe: at time of authoring, project_participants has 5 rows, all side='DESIGNER'.
-- The USING "side"::"ParticipantSide" cast will succeed because 'DESIGNER' is a valid
-- enum value. If run against a DB where side contains values outside the 4-member enum,
-- the cast will fail — that's the intended safety behavior.
--
-- This migration unblocks 20260116000000_add_architect_builder_types, whose
-- ALTER TYPE "ParticipantSide" ADD VALUE IF NOT EXISTS statements for ARCHITECT and
-- BUILDER will no-op cleanly once this has run, and whose eventual use of ARCHITECT
-- or BUILDER as side values would otherwise have been rejected by the old CHECK.

DO $$ BEGIN
    CREATE TYPE "ParticipantSide" AS ENUM ('DESIGNER', 'VENDOR', 'ARCHITECT', 'BUILDER');
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE "project_participants" DROP CONSTRAINT IF EXISTS "project_participants_side_check";

ALTER TABLE "project_participants"
  ALTER COLUMN "side" TYPE "ParticipantSide" USING "side"::"ParticipantSide";
