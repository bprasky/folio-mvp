-- CreateEnum
CREATE TYPE "VendorTier" AS ENUM ('STANDARD', 'PRO', 'ENTERPRISE');

-- AlterTable - Add vendor tier fields to organizations
-- Default to STANDARD so existing vendors are not affected
ALTER TABLE "organizations" ADD COLUMN "vendorTier" "VendorTier" NOT NULL DEFAULT 'STANDARD';
ALTER TABLE "organizations" ADD COLUMN "vendorTierStartedAt" TIMESTAMP(3);
ALTER TABLE "organizations" ADD COLUMN "vendorTierExpiresAt" TIMESTAMP(3);

-- CreateTable - VendorSubscription for subscription history
CREATE TABLE "vendor_subscriptions" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "tier" "VendorTier" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "stripeSubscriptionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vendor_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "vendor_subscriptions_organizationId_idx" ON "vendor_subscriptions"("organizationId");

-- AddForeignKey
ALTER TABLE "vendor_subscriptions" ADD CONSTRAINT "vendor_subscriptions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
