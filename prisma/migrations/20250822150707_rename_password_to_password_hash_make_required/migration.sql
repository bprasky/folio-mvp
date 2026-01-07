/*
  Warnings:

  - You are about to drop the column `baseScore` on the `events` table. All the data in the column will be lost.
  - You are about to drop the column `coverImageUrl` on the `events` table. All the data in the column will be lost.
  - You are about to drop the column `featuredProductIds` on the `events` table. All the data in the column will be lost.
  - You are about to drop the column `spendWeeklyUsd` on the `events` table. All the data in the column will be lost.
  - You are about to drop the column `sponsorshipTier` on the `events` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `events` table. All the data in the column will be lost.
  - You are about to drop the column `type` on the `events` table. All the data in the column will be lost.
  - You are about to drop the column `weight` on the `events` table. All the data in the column will be lost.
  - You are about to drop the column `windowEnd` on the `events` table. All the data in the column will be lost.
  - You are about to drop the column `windowStart` on the `events` table. All the data in the column will be lost.
  - You are about to drop the column `password` on the `users` table. All the data in the column will be lost.
  - Added the required column `passwordHash` to the `users` table without a default value. This is not possible if the table is not empty.
  - Made the column `email` on table `users` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "events" DROP COLUMN "baseScore",
DROP COLUMN "coverImageUrl",
DROP COLUMN "featuredProductIds",
DROP COLUMN "spendWeeklyUsd",
DROP COLUMN "sponsorshipTier",
DROP COLUMN "status",
DROP COLUMN "type",
DROP COLUMN "weight",
DROP COLUMN "windowEnd",
DROP COLUMN "windowStart",
ADD COLUMN     "isFestival" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "users" DROP COLUMN "password",
ADD COLUMN     "passwordHash" TEXT NOT NULL,
ALTER COLUMN "email" SET NOT NULL;

-- CreateTable
CREATE TABLE "posts" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "designerId" TEXT NOT NULL,
    "folderId" TEXT,
    "content" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "post_items" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "imageUrl" TEXT,
    "affiliateUrl" TEXT,
    "section" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "post_items_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_designerId_fkey" FOREIGN KEY ("designerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_items" ADD CONSTRAINT "post_items_postId_fkey" FOREIGN KEY ("postId") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
