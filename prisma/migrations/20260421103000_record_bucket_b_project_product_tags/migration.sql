-- Phase 5H2: record existing project_product_tags in migration history.
-- Table was created hand-managed prior to reliable migration system.
-- CREATE TABLE IF NOT EXISTS for idempotency — prod is untouched; shadow DB gets the table on replay.
-- Column types lifted from information_schema.columns against prod (2026-04-21).

CREATE TABLE IF NOT EXISTS "project_product_tags" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "projectId" TEXT NOT NULL,
    "projectImageId" TEXT,
    "productId" TEXT NOT NULL,
    "x" DOUBLE PRECISION,
    "y" DOUBLE PRECISION,
    "roomName" TEXT,
    "notes" TEXT
    ,
    CONSTRAINT "project_product_tags_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'project_product_tags_productId_fkey') THEN
        ALTER TABLE "project_product_tags" ADD CONSTRAINT "project_product_tags_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'project_product_tags_projectId_fkey') THEN
        ALTER TABLE "project_product_tags" ADD CONSTRAINT "project_product_tags_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'project_product_tags_projectImageId_fkey') THEN
        ALTER TABLE "project_product_tags" ADD CONSTRAINT "project_product_tags_projectImageId_fkey" FOREIGN KEY ("projectImageId") REFERENCES "project_images"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
