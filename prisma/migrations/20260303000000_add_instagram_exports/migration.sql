-- CreateTable
CREATE TABLE "instagram_exports" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "designerId" TEXT NOT NULL,
    "config" JSONB NOT NULL DEFAULT '{}',
    "headline" TEXT,
    "bioText" TEXT,
    "caption" TEXT,
    "imageUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" TEXT NOT NULL DEFAULT 'draft',
    "exportedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "instagram_exports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "instagram_exports_projectId_idx" ON "instagram_exports"("projectId");

-- CreateIndex
CREATE INDEX "instagram_exports_designerId_idx" ON "instagram_exports"("designerId");

-- AddForeignKey
ALTER TABLE "instagram_exports" ADD CONSTRAINT "instagram_exports_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "instagram_exports" ADD CONSTRAINT "instagram_exports_designerId_fkey" FOREIGN KEY ("designerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
