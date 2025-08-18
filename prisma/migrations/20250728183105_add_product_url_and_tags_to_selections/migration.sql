-- AlterTable
ALTER TABLE "selections" ADD COLUMN     "productUrl" TEXT,
ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];
