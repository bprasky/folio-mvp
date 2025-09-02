-- CreateEnum
CREATE TYPE "EventWeight" AS ENUM ('ANCHOR', 'FLEX', 'BACKFILL');

-- CreateEnum
CREATE TYPE "SponsorshipTier" AS ENUM ('FREE', 'SPONSORED', 'PREMIUM');

-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('REQUESTED', 'CONFIRMED', 'DECLINED', 'CANCELLED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "EventType" ADD VALUE 'LAUNCH';
ALTER TYPE "EventType" ADD VALUE 'CEU';
ALTER TYPE "EventType" ADD VALUE 'LUNCH_LEARN';
ALTER TYPE "EventType" ADD VALUE 'PRODUCT_KNOWLEDGE';

-- AlterTable
ALTER TABLE "events" ADD COLUMN     "baseScore" DOUBLE PRECISION DEFAULT 0,
ADD COLUMN     "coverImageUrl" TEXT,
ADD COLUMN     "featuredProductIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "spendWeeklyUsd" INTEGER DEFAULT 0,
ADD COLUMN     "sponsorshipTier" "SponsorshipTier" DEFAULT 'FREE',
ADD COLUMN     "status" "EventStatus" DEFAULT 'PUBLISHED',
ADD COLUMN     "type" "EventType",
ADD COLUMN     "weight" "EventWeight",
ADD COLUMN     "windowEnd" TIMESTAMP(3),
ADD COLUMN     "windowStart" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "event_metrics" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "views" INTEGER NOT NULL DEFAULT 0,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "saves" INTEGER NOT NULL DEFAULT 0,
    "rsvps" INTEGER NOT NULL DEFAULT 0,
    "bookings" INTEGER NOT NULL DEFAULT 0,
    "ctr" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "quality" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "event_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_products" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "name" TEXT,
    "imageUrl" TEXT,
    "price" DECIMAL(10,2),
    "url" TEXT,

    CONSTRAINT "event_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookings" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "designerId" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "requestedStart" TIMESTAMP(3),
    "requestedEnd" TIMESTAMP(3),
    "status" "BookingStatus" NOT NULL DEFAULT 'REQUESTED',
    "notes" TEXT,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "placements" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "page" INTEGER NOT NULL,
    "slot" INTEGER NOT NULL,
    "sizeToken" TEXT NOT NULL,
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validTo" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "placements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "impressions" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "designerId" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sessionId" TEXT,

    CONSTRAINT "impressions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clicks" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "designerId" TEXT,
    "target" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "meta" JSONB,

    CONSTRAINT "clicks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "event_metrics_eventId_key" ON "event_metrics"("eventId");

-- AddForeignKey
ALTER TABLE "event_metrics" ADD CONSTRAINT "event_metrics_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_products" ADD CONSTRAINT "event_products_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "placements" ADD CONSTRAINT "placements_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "impressions" ADD CONSTRAINT "impressions_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clicks" ADD CONSTRAINT "clicks_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
