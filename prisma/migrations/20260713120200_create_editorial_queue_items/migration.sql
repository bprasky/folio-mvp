-- Editorial Queue (docs/17_EDITORIAL_QUEUE.md), migration 3 of 3.
-- Create editorial_queue_items: recommended pieces generated from a
-- DesignerAngle, carrying the stored prompts, per-item distribution consent
-- (16_ATTRIBUTION_CONSENT), the ProjectPost linkage once completed, and the
-- publishing-calendar slot.
--
-- Idempotent: IF NOT EXISTS on the table and indexes, column converge guards
-- for partial prior versions, FK added inside a DO block that swallows
-- duplicate_object, so re-running is a no-op. Column names are camelCase
-- (table-name @@map only). designerId/projectPostId are plain strings per the
-- spec's ADD-only schema — the only FK is angleId → designer_angles.
CREATE TABLE IF NOT EXISTS "editorial_queue_items" (
    "id" TEXT NOT NULL,
    "designerId" TEXT NOT NULL,
    "angleId" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "prompts" JSONB NOT NULL,
    "status" TEXT NOT NULL,
    "distributionConsent" BOOLEAN NOT NULL DEFAULT false,
    "consentScope" TEXT,
    "consentAt" TIMESTAMP(3),
    "projectPostId" TEXT,
    "scheduledSlot" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "editorial_queue_items_pkey" PRIMARY KEY ("id")
);

-- Converge the table if a partial version already existed.
ALTER TABLE "editorial_queue_items" ADD COLUMN IF NOT EXISTS "designerId" TEXT;
ALTER TABLE "editorial_queue_items" ADD COLUMN IF NOT EXISTS "angleId" TEXT;
ALTER TABLE "editorial_queue_items" ADD COLUMN IF NOT EXISTS "format" TEXT;
ALTER TABLE "editorial_queue_items" ADD COLUMN IF NOT EXISTS "prompts" JSONB;
ALTER TABLE "editorial_queue_items" ADD COLUMN IF NOT EXISTS "status" TEXT;
ALTER TABLE "editorial_queue_items" ADD COLUMN IF NOT EXISTS "distributionConsent" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "editorial_queue_items" ADD COLUMN IF NOT EXISTS "consentScope" TEXT;
ALTER TABLE "editorial_queue_items" ADD COLUMN IF NOT EXISTS "consentAt" TIMESTAMP(3);
ALTER TABLE "editorial_queue_items" ADD COLUMN IF NOT EXISTS "projectPostId" TEXT;
ALTER TABLE "editorial_queue_items" ADD COLUMN IF NOT EXISTS "scheduledSlot" TIMESTAMP(3);
ALTER TABLE "editorial_queue_items" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "editorial_queue_items" ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMP(3);

-- @@index([designerId, status]): the designer-facing queue surface.
CREATE INDEX IF NOT EXISTS "editorial_queue_items_designerId_status_idx"
    ON "editorial_queue_items"("designerId", "status");
-- @@index([status, scheduledSlot]): the publishing-calendar job scan.
CREATE INDEX IF NOT EXISTS "editorial_queue_items_status_scheduledSlot_idx"
    ON "editorial_queue_items"("status", "scheduledSlot");

-- angle DesignerAngle @relation(fields: [angleId], references: [id])
DO $$ BEGIN
  ALTER TABLE "editorial_queue_items"
    ADD CONSTRAINT "editorial_queue_items_angleId_fkey"
    FOREIGN KEY ("angleId") REFERENCES "designer_angles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
