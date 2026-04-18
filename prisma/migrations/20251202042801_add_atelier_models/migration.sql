-- Atelier graph: fingerprint per designer/vendor + node/edge/signal models powering taste graph.
-- Authored from prod introspection (4 tables, 4 enums); idempotent.
-- Note: version + snapshot columns on atelier_fingerprints were subsequently added by
--       20260119_presale_infrastructure (ADD COLUMN IF NOT EXISTS). We include them here
--       so a fresh DB replay produces the same final column set regardless of ordering.

DO $$ BEGIN
    CREATE TYPE "AtelierOwnerType" AS ENUM ('DESIGNER', 'VENDOR');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE "AtelierNodeType" AS ENUM ('STYLE', 'ROOM_TYPE', 'MATERIAL', 'VENDOR', 'PRODUCT_CATEGORY', 'COLOR_CLUSTER', 'BEHAVIOR');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE "AtelierRelationType" AS ENUM ('PREFERS', 'FREQUENT_VENDOR', 'USES_MATERIAL', 'PROJECT_ROOM_FOCUS', 'COLOR_TENDENCY', 'EMERGING');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE "AtelierSignalSourceType" AS ENUM ('ONBOARDING', 'PROJECT', 'PROJECT_TAG', 'MOODBOARD', 'PRODUCT_TAG', 'EVENT', 'BEHAVIOR');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "atelier_fingerprints" (
    "id" TEXT NOT NULL,
    "ownerType" "AtelierOwnerType" NOT NULL,
    "designerId" VARCHAR,
    "vendorId" VARCHAR,
    "completeness" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "lastComputedAt" TIMESTAMP,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER DEFAULT 1,
    "snapshot" JSONB,

    CONSTRAINT "atelier_fingerprints_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "atelier_fingerprints_designerId_idx" ON "atelier_fingerprints"("designerId");
CREATE INDEX IF NOT EXISTS "atelier_fingerprints_ownerType_idx" ON "atelier_fingerprints"("ownerType");
CREATE INDEX IF NOT EXISTS "atelier_fingerprints_vendorId_idx" ON "atelier_fingerprints"("vendorId");

CREATE TABLE IF NOT EXISTS "atelier_nodes" (
    "id" TEXT NOT NULL,
    "fingerprintId" TEXT NOT NULL,
    "nodeType" "AtelierNodeType" NOT NULL,
    "label" TEXT NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "metadata" JSONB,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "atelier_nodes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "atelier_nodes_fingerprintId_idx" ON "atelier_nodes"("fingerprintId");
CREATE INDEX IF NOT EXISTS "atelier_nodes_label_idx" ON "atelier_nodes"("label");
CREATE INDEX IF NOT EXISTS "atelier_nodes_nodeType_idx" ON "atelier_nodes"("nodeType");

CREATE TABLE IF NOT EXISTS "atelier_edges" (
    "id" TEXT NOT NULL,
    "fingerprintId" TEXT NOT NULL,
    "sourceNodeId" TEXT NOT NULL,
    "targetNodeId" TEXT NOT NULL,
    "relationType" "AtelierRelationType" NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "atelier_edges_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "atelier_edges_fingerprintId_idx" ON "atelier_edges"("fingerprintId");
CREATE INDEX IF NOT EXISTS "atelier_edges_sourceNodeId_idx" ON "atelier_edges"("sourceNodeId");
CREATE INDEX IF NOT EXISTS "atelier_edges_targetNodeId_idx" ON "atelier_edges"("targetNodeId");

CREATE TABLE IF NOT EXISTS "atelier_signals" (
    "id" TEXT NOT NULL,
    "ownerType" "AtelierOwnerType" NOT NULL,
    "designerId" VARCHAR,
    "vendorId" VARCHAR,
    "sourceType" "AtelierSignalSourceType" NOT NULL,
    "sourceId" TEXT,
    "key" TEXT NOT NULL,
    "value" TEXT,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "occurredAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "atelier_signals_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "atelier_signals_designerId_idx" ON "atelier_signals"("designerId");
CREATE INDEX IF NOT EXISTS "atelier_signals_key_idx" ON "atelier_signals"("key");
CREATE INDEX IF NOT EXISTS "atelier_signals_sourceType_idx" ON "atelier_signals"("sourceType");
CREATE INDEX IF NOT EXISTS "atelier_signals_vendorId_idx" ON "atelier_signals"("vendorId");

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'atelier_fingerprints_designerId_fkey') THEN
        ALTER TABLE "atelier_fingerprints" ADD CONSTRAINT "atelier_fingerprints_designerId_fkey" FOREIGN KEY ("designerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'atelier_fingerprints_vendorId_fkey') THEN
        ALTER TABLE "atelier_fingerprints" ADD CONSTRAINT "atelier_fingerprints_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'atelier_nodes_fingerprintId_fkey') THEN
        ALTER TABLE "atelier_nodes" ADD CONSTRAINT "atelier_nodes_fingerprintId_fkey" FOREIGN KEY ("fingerprintId") REFERENCES "atelier_fingerprints"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'atelier_edges_fingerprintId_fkey') THEN
        ALTER TABLE "atelier_edges" ADD CONSTRAINT "atelier_edges_fingerprintId_fkey" FOREIGN KEY ("fingerprintId") REFERENCES "atelier_fingerprints"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'atelier_edges_sourceNodeId_fkey') THEN
        ALTER TABLE "atelier_edges" ADD CONSTRAINT "atelier_edges_sourceNodeId_fkey" FOREIGN KEY ("sourceNodeId") REFERENCES "atelier_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'atelier_edges_targetNodeId_fkey') THEN
        ALTER TABLE "atelier_edges" ADD CONSTRAINT "atelier_edges_targetNodeId_fkey" FOREIGN KEY ("targetNodeId") REFERENCES "atelier_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'atelier_signals_designerId_fkey') THEN
        ALTER TABLE "atelier_signals" ADD CONSTRAINT "atelier_signals_designerId_fkey" FOREIGN KEY ("designerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'atelier_signals_vendorId_fkey') THEN
        ALTER TABLE "atelier_signals" ADD CONSTRAINT "atelier_signals_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
