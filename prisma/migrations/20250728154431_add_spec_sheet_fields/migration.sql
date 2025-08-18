-- AlterTable
ALTER TABLE "selections" ADD COLUMN     "quantity" INTEGER,
ADD COLUMN     "specSheetFileName" TEXT,
ADD COLUMN     "specSheetUrl" TEXT,
ADD COLUMN     "unitPrice" DECIMAL(10,2),
ADD COLUMN     "vendorProductId" TEXT,
ADD COLUMN     "vendorRepId" TEXT;

-- CreateTable
CREATE TABLE "quotes" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "roomId" TEXT,
    "selectionId" TEXT,
    "quoteUrl" TEXT NOT NULL,
    "quoteFileName" TEXT,
    "totalAmount" DECIMAL(10,2),
    "notes" TEXT,
    "vendorRepId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quotes_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "selections" ADD CONSTRAINT "selections_vendorRepId_fkey" FOREIGN KEY ("vendorRepId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_selectionId_fkey" FOREIGN KEY ("selectionId") REFERENCES "selections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_vendorRepId_fkey" FOREIGN KEY ("vendorRepId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
