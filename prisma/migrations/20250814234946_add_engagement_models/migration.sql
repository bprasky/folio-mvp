/*
  Warnings:

  - You are about to drop the column `type` on the `events` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('PANEL', 'PRODUCT_REVEAL', 'HAPPY_HOUR', 'LUNCH_AND_LEARN', 'INSTALLATION', 'EXHIBITION', 'BOOTH', 'PARTY', 'MEAL', 'TOUR', 'AWARDS', 'WORKSHOP', 'KEYNOTE', 'OTHER', 'FESTIVAL');

-- AlterTable
ALTER TABLE "events" DROP COLUMN "type",
ADD COLUMN     "allowChat" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "allowReshare" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "capacity" INTEGER,
ADD COLUMN     "chatGroupLink" TEXT,
ADD COLUMN     "createdByReputationScore" DOUBLE PRECISION,
ADD COLUMN     "designStyles" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "displayBoostUntil" TIMESTAMP(3),
ADD COLUMN     "eventHashtag" TEXT,
ADD COLUMN     "eventTags" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "eventTypes" "EventType"[],
ADD COLUMN     "includesFood" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "inviteType" TEXT NOT NULL DEFAULT 'open',
ADD COLUMN     "isSponsored" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isVirtual" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "linkedProducts" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "mapLink" TEXT,
ADD COLUMN     "mediaGallery" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "postEventMessage" TEXT,
ADD COLUMN     "promotionTier" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "rsvpDeadline" TIMESTAMP(3),
ADD COLUMN     "targetUserRoles" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "timezone" TEXT,
ADD COLUMN     "waitlistEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "engagement_events" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "productId" TEXT,
    "verb" TEXT NOT NULL,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "engagement_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_product_stats" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "views" INTEGER NOT NULL DEFAULT 0,
    "saves" INTEGER NOT NULL DEFAULT 0,
    "lastSpikeAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_product_stats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "event_product_stats_eventId_productId_key" ON "event_product_stats"("eventId", "productId");

-- AddForeignKey
ALTER TABLE "engagement_events" ADD CONSTRAINT "engagement_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "engagement_events" ADD CONSTRAINT "engagement_events_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "engagement_events" ADD CONSTRAINT "engagement_events_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_product_stats" ADD CONSTRAINT "event_product_stats_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_product_stats" ADD CONSTRAINT "event_product_stats_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
