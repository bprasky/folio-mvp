-- ProjectModule.isAiCompiled — boolean flag distinguishing AI-compiled films from manual uploads.
-- Authored from prod introspection (and confirmed against schema.prisma).

ALTER TABLE "project_modules"
  ADD COLUMN IF NOT EXISTS "isAiCompiled" BOOLEAN NOT NULL DEFAULT false;
