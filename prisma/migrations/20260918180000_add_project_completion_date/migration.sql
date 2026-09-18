-- Approved project completion precision: unknown, year-only, or year/month.
ALTER TABLE "projects"
  ADD COLUMN IF NOT EXISTS "completedYear" INTEGER,
  ADD COLUMN IF NOT EXISTS "completedMonth" INTEGER;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'projects_completion_date_check'
      AND conrelid = 'public.projects'::regclass
  ) THEN
    ALTER TABLE "projects" ADD CONSTRAINT "projects_completion_date_check"
      CHECK (
        ("completedYear" IS NULL AND "completedMonth" IS NULL)
        OR ("completedYear" IS NOT NULL AND "completedYear" BETWEEN 1800 AND 9999
          AND ("completedMonth" IS NULL OR "completedMonth" BETWEEN 1 AND 12))
      );
  END IF;
END $$;
