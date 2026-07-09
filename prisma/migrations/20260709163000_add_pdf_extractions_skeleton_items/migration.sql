-- Create the pdf_extractions and skeleton_items tables. Both models exist in
-- schema.prisma (the PDF finish-book import: extract-pdf stores a PdfExtraction,
-- the confirm step turns selected items into SkeletonItems) but no migration
-- ever created the tables, so production errors with P2021 "The table
-- public.pdf_extractions does not exist" (and skeleton_items would be next).
--
-- Idempotent: enum via DO/duplicate_object, IF NOT EXISTS on tables and indexes,
-- FKs added inside DO blocks that swallow duplicate_object, so re-running is a
-- no-op. Column names are camelCase (the models use @@map only for table names,
-- no per-field @map), types and onDelete match the schema.

-- SkeletonItemStatus enum ------------------------------------------------------
DO $$ BEGIN
    CREATE TYPE "SkeletonItemStatus" AS ENUM ('UNCONFIRMED', 'CONFIRMED', 'DISMISSED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- pdf_extractions --------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "pdf_extractions" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "result" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending_review',
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pdf_extractions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "pdf_extractions_projectId_idx" ON "pdf_extractions"("projectId");
CREATE INDEX IF NOT EXISTS "pdf_extractions_createdBy_idx" ON "pdf_extractions"("createdBy");
CREATE INDEX IF NOT EXISTS "pdf_extractions_status_idx" ON "pdf_extractions"("status");

-- project Project @relation(... onDelete: Cascade)
DO $$ BEGIN
  ALTER TABLE "pdf_extractions"
    ADD CONSTRAINT "pdf_extractions_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- skeleton_items ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "skeleton_items" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "searchQuery" TEXT,
    "description" TEXT,
    "imageData" TEXT,
    "imageUrl" TEXT,
    "extractedBrand" TEXT,
    "extractedPrice" INTEGER,
    "extractedMaterial" TEXT,
    "extractedDimensions" JSONB,
    "sourceExtractionId" TEXT,
    "sourcePage" INTEGER,
    "confirmedProductId" TEXT,
    "resultingSelectionId" TEXT,
    "status" "SkeletonItemStatus" NOT NULL DEFAULT 'UNCONFIRMED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "skeleton_items_pkey" PRIMARY KEY ("id")
);

-- resultingSelectionId String? @unique
CREATE UNIQUE INDEX IF NOT EXISTS "skeleton_items_resultingSelectionId_key" ON "skeleton_items"("resultingSelectionId");
CREATE INDEX IF NOT EXISTS "skeleton_items_roomId_idx" ON "skeleton_items"("roomId");
CREATE INDEX IF NOT EXISTS "skeleton_items_projectId_idx" ON "skeleton_items"("projectId");
CREATE INDEX IF NOT EXISTS "skeleton_items_status_idx" ON "skeleton_items"("status");
CREATE INDEX IF NOT EXISTS "skeleton_items_sourceExtractionId_idx" ON "skeleton_items"("sourceExtractionId");

-- room Room @relation(... onDelete: Cascade)
DO $$ BEGIN
  ALTER TABLE "skeleton_items"
    ADD CONSTRAINT "skeleton_items_roomId_fkey"
    FOREIGN KEY ("roomId") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- project Project @relation(... onDelete: Cascade)
DO $$ BEGIN
  ALTER TABLE "skeleton_items"
    ADD CONSTRAINT "skeleton_items_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- confirmedProduct Product? @relation(...) — optional, Prisma default onDelete: SetNull
DO $$ BEGIN
  ALTER TABLE "skeleton_items"
    ADD CONSTRAINT "skeleton_items_confirmedProductId_fkey"
    FOREIGN KEY ("confirmedProductId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
