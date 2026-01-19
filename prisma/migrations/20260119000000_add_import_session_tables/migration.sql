-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "ImportSourceType" AS ENUM ('PRESENTATION', 'WEBSITE', 'BULK_IMAGES');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "ImportSessionStatus" AS ENUM ('PROCESSING', 'ANALYZED', 'READY_FOR_REVIEW', 'COMPLETED', 'FAILED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "PendingTagStatus" AS ENUM ('UNREVIEWED', 'CONFIRMED', 'CORRECTED', 'DISMISSED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "import_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sourceType" "ImportSourceType" NOT NULL,
    "sourceUrl" TEXT,
    "fileName" TEXT,
    "status" "ImportSessionStatus" NOT NULL DEFAULT 'PROCESSING',
    "projectId" TEXT,
    "totalImages" INTEGER NOT NULL DEFAULT 0,
    "totalProducts" INTEGER NOT NULL DEFAULT 0,
    "verifiedTags" INTEGER NOT NULL DEFAULT 0,
    "processingMeta" JSONB,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "import_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "pending_product_tags" (
    "id" TEXT NOT NULL,
    "importSessionId" TEXT NOT NULL,
    "projectImageId" TEXT,
    "tempImageUrl" TEXT,
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "searchQuery" TEXT NOT NULL,
    "suggestions" JSONB NOT NULL,
    "topSuggestion" JSONB,
    "detectionConfidence" TEXT NOT NULL,
    "attributionConfidence" TEXT,
    "status" "PendingTagStatus" NOT NULL DEFAULT 'UNREVIEWED',
    "confirmedProductId" TEXT,
    "correctionNote" TEXT,
    "resultingTagId" TEXT,
    "roomType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "pending_product_tags_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "import_sessions_userId_idx" ON "import_sessions"("userId");
CREATE INDEX IF NOT EXISTS "import_sessions_status_idx" ON "import_sessions"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "pending_product_tags_importSessionId_status_idx" ON "pending_product_tags"("importSessionId", "status");
CREATE UNIQUE INDEX IF NOT EXISTS "pending_product_tags_resultingTagId_key" ON "pending_product_tags"("resultingTagId");

-- AddForeignKey (with IF NOT EXISTS check)
DO $$ BEGIN
    ALTER TABLE "pending_product_tags" ADD CONSTRAINT "pending_product_tags_importSessionId_fkey" FOREIGN KEY ("importSessionId") REFERENCES "import_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
