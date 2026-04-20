-- Create notifications table for Notification model declared in schema.prisma (lines 3568-3584).
--
-- Authored 2026-04-20 as Phase 5B Bucket 3 item 1.
--
-- Phantom-model fix: schema.prisma declares model Notification mapped to table
-- "notifications", but prod has no such table. 25 call sites in 13 src/ files use
-- prisma.notification.create (and friends); 20 of those are writes, 4 are findFirst
-- dedupe checks immediately preceding writes. Every notification create on the golden
-- path (contribution publish, product tagging) 500s today.
--
-- 10 scalar columns. One FK to users(id) CASCADE. Two indexes matching @@index
-- declarations in schema.prisma. No enum dependencies — Notification.type is String,
-- not an enum.
--
-- TIMESTAMPTZ for createdAt and readAt per the convention established in Phase 4 IG
-- feature migrations (instagram_exports, instagram_campaigns). JSONB for metadata.
-- Idempotent throughout: CREATE TABLE IF NOT EXISTS, CREATE INDEX IF NOT EXISTS,
-- FK wrapped in DO $$ pg_constraint existence guard.

CREATE TABLE IF NOT EXISTS "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "actionUrl" TEXT,
    "metadata" JSONB,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "notifications_userId_read_idx" ON "notifications"("userId", "read");
CREATE INDEX IF NOT EXISTS "notifications_createdAt_idx" ON "notifications"("createdAt");

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notifications_userId_fkey') THEN
        ALTER TABLE "notifications"
            ADD CONSTRAINT "notifications_userId_fkey"
            FOREIGN KEY ("userId") REFERENCES "users"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
