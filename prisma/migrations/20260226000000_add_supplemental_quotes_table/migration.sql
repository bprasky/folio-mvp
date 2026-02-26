-- CreateTable
CREATE TABLE "supplemental_quotes" (
    "id" TEXT NOT NULL,
    "projectPostId" TEXT NOT NULL,
    "productTagId" TEXT,
    "userId" TEXT,
    "contributorRole" TEXT,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "displayLocation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplemental_quotes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "supplemental_quotes_projectPostId_idx" ON "supplemental_quotes"("projectPostId");

-- CreateIndex
CREATE INDEX "supplemental_quotes_productTagId_idx" ON "supplemental_quotes"("productTagId");

-- CreateIndex
CREATE INDEX "supplemental_quotes_userId_idx" ON "supplemental_quotes"("userId");

-- AddForeignKey
ALTER TABLE "supplemental_quotes" ADD CONSTRAINT "supplemental_quotes_projectPostId_fkey" FOREIGN KEY ("projectPostId") REFERENCES "project_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplemental_quotes" ADD CONSTRAINT "supplemental_quotes_productTagId_fkey" FOREIGN KEY ("productTagId") REFERENCES "product_tags"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplemental_quotes" ADD CONSTRAINT "supplemental_quotes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
