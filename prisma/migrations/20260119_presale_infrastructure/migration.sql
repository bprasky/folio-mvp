-- Presale Infrastructure Migration
-- Adds Development, Consultation, and AtelierDeployment models

-- ============================================================
-- NEW ENUMS
-- ============================================================

-- DevelopmentStatus enum
CREATE TYPE "DevelopmentStatus" AS ENUM ('PLANNING', 'PRE_CONSTRUCTION', 'UNDER_CONSTRUCTION', 'READY_FOR_OCCUPANCY', 'SOLD_OUT');

-- FinishPackageTier enum
CREATE TYPE "FinishPackageTier" AS ENUM ('STANDARD', 'UPGRADE_1', 'UPGRADE_2', 'PREMIUM', 'CUSTOM');

-- ConsultationStatus enum
CREATE TYPE "ConsultationStatus" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'ABANDONED', 'EXPIRED');

-- AtelierDeploymentType enum
CREATE TYPE "AtelierDeploymentType" AS ENUM ('DEVELOPMENT_CONSULTATION', 'VENDOR_CONFIGURATOR', 'DESIGNER_ASSISTANT');

-- ============================================================
-- EXTEND EXISTING ENUMS
-- ============================================================

-- Add DEVELOPER to Role enum
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'DEVELOPER';

-- Add DEVELOPER to OrgType enum
ALTER TYPE "OrgType" ADD VALUE IF NOT EXISTS 'DEVELOPER';

-- ============================================================
-- EXTEND EXISTING TABLES
-- ============================================================

-- Add version and snapshot to atelier_fingerprints
ALTER TABLE "atelier_fingerprints" ADD COLUMN IF NOT EXISTS "version" INTEGER DEFAULT 1;
ALTER TABLE "atelier_fingerprints" ADD COLUMN IF NOT EXISTS "snapshot" JSONB;

-- ============================================================
-- NEW TABLES
-- ============================================================

-- Developments table
CREATE TABLE "developments" (
    "id" TEXT NOT NULL,
    "developerOrgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'USA',
    "totalUnits" INTEGER NOT NULL,
    "status" "DevelopmentStatus" NOT NULL DEFAULT 'PLANNING',
    "expectedCompletion" TIMESTAMP(3),
    "consultationsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "defaultDesignerId" TEXT,
    "heroImageUrl" TEXT,
    "galleryUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "developments_pkey" PRIMARY KEY ("id")
);

-- Unit types table
CREATE TABLE "unit_types" (
    "id" TEXT NOT NULL,
    "developmentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "squareFootage" INTEGER,
    "bedrooms" INTEGER NOT NULL,
    "bathrooms" DOUBLE PRECISION NOT NULL,
    "basePriceCents" INTEGER,
    "floorPlanUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "unit_types_pkey" PRIMARY KEY ("id")
);

-- Unit type rooms table
CREATE TABLE "unit_type_rooms" (
    "id" TEXT NOT NULL,
    "unitTypeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,

    CONSTRAINT "unit_type_rooms_pkey" PRIMARY KEY ("id")
);

-- Finish slots table
CREATE TABLE "finish_slots" (
    "id" TEXT NOT NULL,
    "unitTypeRoomId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "isCustomizable" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "finish_slots_pkey" PRIMARY KEY ("id")
);

-- Development products table (constrained catalog)
CREATE TABLE "development_products" (
    "id" TEXT NOT NULL,
    "developmentId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "availableInPackages" "FinishPackageTier"[] DEFAULT ARRAY['STANDARD']::"FinishPackageTier"[],
    "isUpgrade" BOOLEAN NOT NULL DEFAULT false,
    "upgradePriceCents" INTEGER,
    "allowedSlots" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "development_products_pkey" PRIMARY KEY ("id")
);

-- Finish packages table
CREATE TABLE "finish_packages" (
    "id" TEXT NOT NULL,
    "developmentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tier" "FinishPackageTier" NOT NULL,
    "description" TEXT,
    "priceDeltaCents" INTEGER NOT NULL DEFAULT 0,
    "heroImageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "finish_packages_pkey" PRIMARY KEY ("id")
);

-- Finish package defaults table
CREATE TABLE "finish_package_defaults" (
    "id" TEXT NOT NULL,
    "finishPackageId" TEXT NOT NULL,
    "slotKey" TEXT NOT NULL,
    "roomType" TEXT NOT NULL,
    "developmentProductId" TEXT NOT NULL,

    CONSTRAINT "finish_package_defaults_pkey" PRIMARY KEY ("id")
);

-- Development designers table
CREATE TABLE "development_designers" (
    "id" TEXT NOT NULL,
    "developmentId" TEXT NOT NULL,
    "designerId" TEXT NOT NULL,
    "consultationFeeShare" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "development_designers_pkey" PRIMARY KEY ("id")
);

-- Consultations table
CREATE TABLE "consultations" (
    "id" TEXT NOT NULL,
    "developmentId" TEXT NOT NULL,
    "unitTypeId" TEXT,
    "finishPackageId" TEXT,
    "buyerId" TEXT NOT NULL,
    "designerId" TEXT NOT NULL,
    "deploymentId" TEXT,
    "status" "ConsultationStatus" NOT NULL DEFAULT 'SCHEDULED',
    "scheduledAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "durationMinutes" INTEGER,
    "conversationHistory" JSONB,
    "summary" TEXT,
    "designerNotes" TEXT,
    "attributionLocked" BOOLEAN NOT NULL DEFAULT false,
    "consultationFeeCents" INTEGER,
    "designerEarningsCents" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "consultations_pkey" PRIMARY KEY ("id")
);

-- Consultation selections table
CREATE TABLE "consultation_selections" (
    "id" TEXT NOT NULL,
    "consultationId" TEXT NOT NULL,
    "slotKey" TEXT NOT NULL,
    "roomType" TEXT NOT NULL,
    "developmentProductId" TEXT NOT NULL,
    "reasoning" TEXT,
    "alternatives" JSONB,
    "buyerAccepted" BOOLEAN NOT NULL DEFAULT true,
    "buyerNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consultation_selections_pkey" PRIMARY KEY ("id")
);

-- Consultation buyers table (lightweight auth)
CREATE TABLE "consultation_buyers" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "userId" TEXT,
    "developmentId" TEXT NOT NULL,
    "unitNumber" TEXT,
    "sessionToken" TEXT NOT NULL,
    "sessionExpiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consultation_buyers_pkey" PRIMARY KEY ("id")
);

-- Atelier deployments table
CREATE TABLE "atelier_deployments" (
    "id" TEXT NOT NULL,
    "fingerprintId" TEXT NOT NULL,
    "deploymentType" "AtelierDeploymentType" NOT NULL,
    "developmentId" TEXT,
    "contextPrompt" TEXT,
    "config" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "atelier_deployments_pkey" PRIMARY KEY ("id")
);

-- ============================================================
-- UNIQUE CONSTRAINTS
-- ============================================================

CREATE UNIQUE INDEX "developments_slug_key" ON "developments"("slug");
CREATE UNIQUE INDEX "unit_types_developmentId_code_key" ON "unit_types"("developmentId", "code");
CREATE UNIQUE INDEX "finish_slots_unitTypeRoomId_key_key" ON "finish_slots"("unitTypeRoomId", "key");
CREATE UNIQUE INDEX "development_products_developmentId_productId_key" ON "development_products"("developmentId", "productId");
CREATE UNIQUE INDEX "finish_packages_developmentId_tier_key" ON "finish_packages"("developmentId", "tier");
CREATE UNIQUE INDEX "finish_package_defaults_finishPackageId_slotKey_roomType_key" ON "finish_package_defaults"("finishPackageId", "slotKey", "roomType");
CREATE UNIQUE INDEX "development_designers_developmentId_designerId_key" ON "development_designers"("developmentId", "designerId");
CREATE UNIQUE INDEX "consultation_selections_consultationId_slotKey_roomType_key" ON "consultation_selections"("consultationId", "slotKey", "roomType");
CREATE UNIQUE INDEX "consultation_buyers_userId_key" ON "consultation_buyers"("userId");
CREATE UNIQUE INDEX "consultation_buyers_sessionToken_key" ON "consultation_buyers"("sessionToken");
CREATE UNIQUE INDEX "consultation_buyers_email_developmentId_key" ON "consultation_buyers"("email", "developmentId");

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX "developments_status_idx" ON "developments"("status");
CREATE INDEX "developments_city_state_idx" ON "developments"("city", "state");
CREATE INDEX "developments_developerOrgId_idx" ON "developments"("developerOrgId");
CREATE INDEX "development_products_developmentId_idx" ON "development_products"("developmentId");
CREATE INDEX "consultations_buyerId_idx" ON "consultations"("buyerId");
CREATE INDEX "consultations_designerId_idx" ON "consultations"("designerId");
CREATE INDEX "consultations_developmentId_status_idx" ON "consultations"("developmentId", "status");
CREATE INDEX "consultation_buyers_sessionToken_idx" ON "consultation_buyers"("sessionToken");
CREATE INDEX "atelier_deployments_fingerprintId_isActive_idx" ON "atelier_deployments"("fingerprintId", "isActive");
CREATE INDEX "atelier_deployments_developmentId_idx" ON "atelier_deployments"("developmentId");

-- ============================================================
-- FOREIGN KEY CONSTRAINTS
-- ============================================================

-- Developments
ALTER TABLE "developments" ADD CONSTRAINT "developments_developerOrgId_fkey" FOREIGN KEY ("developerOrgId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Unit types
ALTER TABLE "unit_types" ADD CONSTRAINT "unit_types_developmentId_fkey" FOREIGN KEY ("developmentId") REFERENCES "developments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Unit type rooms
ALTER TABLE "unit_type_rooms" ADD CONSTRAINT "unit_type_rooms_unitTypeId_fkey" FOREIGN KEY ("unitTypeId") REFERENCES "unit_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Finish slots
ALTER TABLE "finish_slots" ADD CONSTRAINT "finish_slots_unitTypeRoomId_fkey" FOREIGN KEY ("unitTypeRoomId") REFERENCES "unit_type_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Development products
ALTER TABLE "development_products" ADD CONSTRAINT "development_products_developmentId_fkey" FOREIGN KEY ("developmentId") REFERENCES "developments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "development_products" ADD CONSTRAINT "development_products_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Finish packages
ALTER TABLE "finish_packages" ADD CONSTRAINT "finish_packages_developmentId_fkey" FOREIGN KEY ("developmentId") REFERENCES "developments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Finish package defaults
ALTER TABLE "finish_package_defaults" ADD CONSTRAINT "finish_package_defaults_finishPackageId_fkey" FOREIGN KEY ("finishPackageId") REFERENCES "finish_packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "finish_package_defaults" ADD CONSTRAINT "finish_package_defaults_developmentProductId_fkey" FOREIGN KEY ("developmentProductId") REFERENCES "development_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Development designers
ALTER TABLE "development_designers" ADD CONSTRAINT "development_designers_developmentId_fkey" FOREIGN KEY ("developmentId") REFERENCES "developments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "development_designers" ADD CONSTRAINT "development_designers_designerId_fkey" FOREIGN KEY ("designerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Consultations
ALTER TABLE "consultations" ADD CONSTRAINT "consultations_developmentId_fkey" FOREIGN KEY ("developmentId") REFERENCES "developments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "consultations" ADD CONSTRAINT "consultations_unitTypeId_fkey" FOREIGN KEY ("unitTypeId") REFERENCES "unit_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "consultations" ADD CONSTRAINT "consultations_finishPackageId_fkey" FOREIGN KEY ("finishPackageId") REFERENCES "finish_packages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "consultations" ADD CONSTRAINT "consultations_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "consultations" ADD CONSTRAINT "consultations_designerId_fkey" FOREIGN KEY ("designerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "consultations" ADD CONSTRAINT "consultations_deploymentId_fkey" FOREIGN KEY ("deploymentId") REFERENCES "atelier_deployments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Consultation selections
ALTER TABLE "consultation_selections" ADD CONSTRAINT "consultation_selections_consultationId_fkey" FOREIGN KEY ("consultationId") REFERENCES "consultations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "consultation_selections" ADD CONSTRAINT "consultation_selections_developmentProductId_fkey" FOREIGN KEY ("developmentProductId") REFERENCES "development_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Consultation buyers
ALTER TABLE "consultation_buyers" ADD CONSTRAINT "consultation_buyers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "consultation_buyers" ADD CONSTRAINT "consultation_buyers_developmentId_fkey" FOREIGN KEY ("developmentId") REFERENCES "developments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Atelier deployments
ALTER TABLE "atelier_deployments" ADD CONSTRAINT "atelier_deployments_fingerprintId_fkey" FOREIGN KEY ("fingerprintId") REFERENCES "atelier_fingerprints"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "atelier_deployments" ADD CONSTRAINT "atelier_deployments_developmentId_fkey" FOREIGN KEY ("developmentId") REFERENCES "developments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
