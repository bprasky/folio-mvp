-- CreateEnum
CREATE TYPE "VendorInviteCandidateStatus" AS ENUM ('PENDING', 'READY', 'INVITED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "vendor_invite_candidates" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "vendorName" TEXT NOT NULL,
    "vendorWebsite" TEXT,
    "repEmail" TEXT,
    "repName" TEXT,
    "status" "VendorInviteCandidateStatus" NOT NULL DEFAULT 'PENDING',
    "normalizedKey" TEXT NOT NULL,
    "firstSeenByDesignerId" TEXT,
    "firstSeenInProjectId" TEXT,

    CONSTRAINT "vendor_invite_candidates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_invite_signals" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "candidateId" TEXT NOT NULL,
    "designerId" TEXT NOT NULL,
    "projectId" TEXT,
    "tagId" TEXT,

    CONSTRAINT "vendor_invite_signals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "vendor_invite_candidates_normalizedKey_key" ON "vendor_invite_candidates"("normalizedKey");

-- CreateIndex
CREATE INDEX "vendor_invite_candidates_status_idx" ON "vendor_invite_candidates"("status");

-- CreateIndex
CREATE INDEX "vendor_invite_candidates_normalizedKey_idx" ON "vendor_invite_candidates"("normalizedKey");

-- CreateIndex
CREATE INDEX "vendor_invite_candidates_firstSeenByDesignerId_idx" ON "vendor_invite_candidates"("firstSeenByDesignerId");

-- CreateIndex
CREATE INDEX "vendor_invite_candidates_createdAt_idx" ON "vendor_invite_candidates"("createdAt");

-- CreateIndex
CREATE INDEX "vendor_invite_signals_candidateId_idx" ON "vendor_invite_signals"("candidateId");

-- CreateIndex
CREATE INDEX "vendor_invite_signals_designerId_idx" ON "vendor_invite_signals"("designerId");

-- CreateIndex
CREATE INDEX "vendor_invite_signals_projectId_idx" ON "vendor_invite_signals"("projectId");

-- CreateIndex
CREATE INDEX "vendor_invite_signals_createdAt_idx" ON "vendor_invite_signals"("createdAt");

-- AddForeignKey
ALTER TABLE "vendor_invite_candidates" ADD CONSTRAINT "vendor_invite_candidates_firstSeenByDesignerId_fkey" FOREIGN KEY ("firstSeenByDesignerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_invite_candidates" ADD CONSTRAINT "vendor_invite_candidates_firstSeenInProjectId_fkey" FOREIGN KEY ("firstSeenInProjectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_invite_signals" ADD CONSTRAINT "vendor_invite_signals_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "vendor_invite_candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_invite_signals" ADD CONSTRAINT "vendor_invite_signals_designerId_fkey" FOREIGN KEY ("designerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_invite_signals" ADD CONSTRAINT "vendor_invite_signals_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;








