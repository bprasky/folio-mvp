-- REVIEW ONLY: not applied. Generated against the current schema; additive tables, guarded DDL.
-- CreateTable
CREATE TABLE IF NOT EXISTS "editorial_stories" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "organizationId" TEXT,
    "queueItemId" TEXT,
    "slug" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "publishedRevisionNumber" INTEGER,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "editorial_stories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "editorial_story_revisions" (
    "id" TEXT NOT NULL,
    "storyId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "blocks" JSONB NOT NULL,
    "interview" JSONB NOT NULL,
    "editVersion" INTEGER NOT NULL DEFAULT 1,
    "answersReviewedAt" TIMESTAMPTZ(3),
    "approvedById" TEXT,
    "approvedAt" TIMESTAMPTZ(3),
    "consentScope" TEXT,
    "publishedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "editorial_story_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "editorial_story_answers" (
    "id" TEXT NOT NULL,
    "revisionId" TEXT NOT NULL,
    "promptId" TEXT NOT NULL,
    "questionText" TEXT NOT NULL,
    "answerText" TEXT NOT NULL,
    "answeredById" TEXT NOT NULL,
    "answeredAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "editorial_story_answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "editorial_story_sources" (
    "revisionId" TEXT NOT NULL,
    "projectPostId" TEXT NOT NULL,
    "sourceDigest" TEXT NOT NULL,

    CONSTRAINT "editorial_story_sources_pkey" PRIMARY KEY ("revisionId","projectPostId")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "editorial_stories_queueItemId_key" ON "editorial_stories"("queueItemId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "editorial_stories_slug_key" ON "editorial_stories"("slug");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "editorial_stories_ownerId_organizationId_updatedAt_idx" ON "editorial_stories"("ownerId", "organizationId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "editorial_story_revisions_storyId_number_key" ON "editorial_story_revisions"("storyId", "number");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "editorial_story_answers_revisionId_promptId_key" ON "editorial_story_answers"("revisionId", "promptId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "editorial_story_sources_projectPostId_idx" ON "editorial_story_sources"("projectPostId");

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'editorial_stories'::regclass AND conname = 'editorial_stories_ownerId_fkey') THEN
    ALTER TABLE "editorial_stories" ADD CONSTRAINT "editorial_stories_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'editorial_stories'::regclass AND conname = 'editorial_stories_organizationId_fkey') THEN
    ALTER TABLE "editorial_stories" ADD CONSTRAINT "editorial_stories_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'editorial_stories'::regclass AND conname = 'editorial_stories_queueItemId_fkey') THEN
    ALTER TABLE "editorial_stories" ADD CONSTRAINT "editorial_stories_queueItemId_fkey" FOREIGN KEY ("queueItemId") REFERENCES "editorial_queue_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'editorial_stories'::regclass AND conname = 'editorial_stories_published_fkey') THEN
    ALTER TABLE "editorial_stories" ADD CONSTRAINT "editorial_stories_published_fkey" FOREIGN KEY ("id", "publishedRevisionNumber") REFERENCES "editorial_story_revisions"("storyId", "number") ON DELETE RESTRICT ON UPDATE RESTRICT;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'editorial_story_revisions'::regclass AND conname = 'editorial_story_revisions_storyId_fkey') THEN
    ALTER TABLE "editorial_story_revisions" ADD CONSTRAINT "editorial_story_revisions_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "editorial_stories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'editorial_story_revisions'::regclass AND conname = 'editorial_story_revisions_approvedById_fkey') THEN
    ALTER TABLE "editorial_story_revisions" ADD CONSTRAINT "editorial_story_revisions_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'editorial_story_answers'::regclass AND conname = 'editorial_story_answers_revisionId_fkey') THEN
    ALTER TABLE "editorial_story_answers" ADD CONSTRAINT "editorial_story_answers_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "editorial_story_revisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'editorial_story_answers'::regclass AND conname = 'editorial_story_answers_answeredById_fkey') THEN
    ALTER TABLE "editorial_story_answers" ADD CONSTRAINT "editorial_story_answers_answeredById_fkey" FOREIGN KEY ("answeredById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'editorial_story_sources'::regclass AND conname = 'editorial_story_sources_revisionId_fkey') THEN
    ALTER TABLE "editorial_story_sources" ADD CONSTRAINT "editorial_story_sources_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "editorial_story_revisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'editorial_story_sources'::regclass AND conname = 'editorial_story_sources_projectPostId_fkey') THEN
    ALTER TABLE "editorial_story_sources" ADD CONSTRAINT "editorial_story_sources_projectPostId_fkey" FOREIGN KEY ("projectPostId") REFERENCES "project_posts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;


DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'editorial_stories'::regclass AND conname = 'editorial_stories_status_check') THEN
  ALTER TABLE "editorial_stories" ADD CONSTRAINT "editorial_stories_status_check" CHECK (status IN ('draft','published','withdrawn') AND (status <> 'published' OR "publishedRevisionNumber" IS NOT NULL));
 END IF;
END $$;

DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'editorial_story_revisions'::regclass AND conname = 'editorial_story_revision_state_check') THEN
  ALTER TABLE "editorial_story_revisions" ADD CONSTRAINT "editorial_story_revision_state_check" CHECK (number > 0 AND "editVersion" > 0 AND (("approvedAt" IS NULL AND "approvedById" IS NULL AND "consentScope" IS NULL) OR ("approvedAt" IS NOT NULL AND "approvedById" IS NOT NULL AND "consentScope" IS NOT NULL AND "answersReviewedAt" IS NOT NULL AND "consentScope" IN ('feed_only','feed_and_social'))) AND ("publishedAt" IS NULL OR "approvedAt" IS NOT NULL));
 END IF;
END $$;

ALTER TABLE "editorial_stories" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "editorial_story_revisions" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "editorial_story_answers" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "editorial_story_sources" ENABLE ROW LEVEL SECURITY;
