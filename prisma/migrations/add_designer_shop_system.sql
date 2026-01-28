-- Designer Shop System Migration
-- Creates ShopProduct, ShopBoost, and ProductTestimonial tables

-- Create ShopBoostStatus enum
CREATE TYPE "ShopBoostStatus" AS ENUM ('PENDING', 'APPROVED', 'ACTIVE', 'DECLINED', 'EXPIRED', 'CANCELLED');

-- Create shop_products table
CREATE TABLE "shop_products" (
    "id" TEXT NOT NULL,
    "designerId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "projectId" TEXT,
    "quote" TEXT,
    "quoteApprovedAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shop_products_pkey" PRIMARY KEY ("id")
);

-- Create shop_boosts table
CREATE TABLE "shop_boosts" (
    "id" TEXT NOT NULL,
    "shopProductId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "status" "ShopBoostStatus" NOT NULL DEFAULT 'PENDING',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "amountPaid" DECIMAL(10, 2) NOT NULL,
    "designerCredit" DECIMAL(10, 2) NOT NULL,
    "folioRevenue" DECIMAL(10, 2) NOT NULL,
    "approvedAt" TIMESTAMP(3),
    "declinedAt" TIMESTAMP(3),
    "declineReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shop_boosts_pkey" PRIMARY KEY ("id")
);

-- Create product_testimonials table
CREATE TABLE "product_testimonials" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "shopProductId" TEXT NOT NULL,
    "quote" TEXT NOT NULL,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_testimonials_pkey" PRIMARY KEY ("id")
);

-- Create unique constraint on shop_products (designerId, productId)
CREATE UNIQUE INDEX "shop_products_designerId_productId_key" ON "shop_products"("designerId", "productId");

-- Create unique constraint on product_testimonials (shopProductId)
CREATE UNIQUE INDEX "product_testimonials_shopProductId_key" ON "product_testimonials"("shopProductId");

-- Create indexes for shop_products
CREATE INDEX "shop_products_designerId_idx" ON "shop_products"("designerId");
CREATE INDEX "shop_products_productId_idx" ON "shop_products"("productId");

-- Create indexes for shop_boosts
CREATE INDEX "shop_boosts_shopProductId_idx" ON "shop_boosts"("shopProductId");
CREATE INDEX "shop_boosts_vendorId_idx" ON "shop_boosts"("vendorId");
CREATE INDEX "shop_boosts_status_idx" ON "shop_boosts"("status");

-- Create index for product_testimonials
CREATE INDEX "product_testimonials_productId_idx" ON "product_testimonials"("productId");

-- Add foreign keys for shop_products
ALTER TABLE "shop_products" ADD CONSTRAINT "shop_products_designerId_fkey" FOREIGN KEY ("designerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "shop_products" ADD CONSTRAINT "shop_products_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "shop_products" ADD CONSTRAINT "shop_products_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add foreign keys for shop_boosts
ALTER TABLE "shop_boosts" ADD CONSTRAINT "shop_boosts_shopProductId_fkey" FOREIGN KEY ("shopProductId") REFERENCES "shop_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "shop_boosts" ADD CONSTRAINT "shop_boosts_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add foreign keys for product_testimonials
ALTER TABLE "product_testimonials" ADD CONSTRAINT "product_testimonials_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "product_testimonials" ADD CONSTRAINT "product_testimonials_shopProductId_fkey" FOREIGN KEY ("shopProductId") REFERENCES "shop_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
