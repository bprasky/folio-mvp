-- Vision label events (training-data flywheel). Append-only log of model
-- predictions + human corrections, tagged with the producing model so the
-- prediction→correction delta is computable across any vision tool.
-- ADD-only, fully idempotent.

DO $$ BEGIN
  CREATE TYPE "LabelSource" AS ENUM ('MODEL', 'HUMAN');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "vision_label_events" (
  "id"        TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "projectId" TEXT NOT NULL,
  "imageId"   TEXT,
  "roomId"    TEXT,
  "userId"    TEXT,
  "source"    "LabelSource" NOT NULL,
  "model"     TEXT,
  "taskType"  TEXT NOT NULL,
  "action"    TEXT,
  "value"     JSONB NOT NULL,
  CONSTRAINT "vision_label_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "vision_label_events_projectId_idx" ON "vision_label_events"("projectId");
CREATE INDEX IF NOT EXISTS "vision_label_events_imageId_idx" ON "vision_label_events"("imageId");
CREATE INDEX IF NOT EXISTS "vision_label_events_source_taskType_idx" ON "vision_label_events"("source", "taskType");
