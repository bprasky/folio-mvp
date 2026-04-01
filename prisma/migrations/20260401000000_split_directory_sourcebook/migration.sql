-- CreateTable
CREATE TABLE "sourcebook_entries" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "notes" TEXT,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sourcebook_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "directory_bookmarks" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "professionalId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "directory_bookmarks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sourcebook_entries_userId_archived_idx" ON "sourcebook_entries"("userId", "archived");

-- CreateIndex
CREATE UNIQUE INDEX "sourcebook_entries_userId_productId_key" ON "sourcebook_entries"("userId", "productId");

-- CreateIndex
CREATE INDEX "directory_bookmarks_userId_idx" ON "directory_bookmarks"("userId");

-- CreateIndex
CREATE INDEX "directory_bookmarks_professionalId_idx" ON "directory_bookmarks"("professionalId");

-- CreateIndex
CREATE UNIQUE INDEX "directory_bookmarks_userId_professionalId_key" ON "directory_bookmarks"("userId", "professionalId");

-- AddForeignKey
ALTER TABLE "sourcebook_entries" ADD CONSTRAINT "sourcebook_entries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sourcebook_entries" ADD CONSTRAINT "sourcebook_entries_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "directory_bookmarks" ADD CONSTRAINT "directory_bookmarks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "directory_bookmarks" ADD CONSTRAINT "directory_bookmarks_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
