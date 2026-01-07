-- Add VendorInviteContact model for multi-contact support (no overwrites)
-- This migration adds support for multiple rep emails per vendor candidate

-- CreateTable
CREATE TABLE "vendor_invite_contacts" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "candidateId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "title" TEXT,
    "domain" TEXT,
    "designerId" TEXT NOT NULL,
    "projectId" TEXT,
    "tagId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'TAGGING',
    "sourceUrl" TEXT,

    CONSTRAINT "vendor_invite_contacts_pkey" PRIMARY KEY ("id")
);

-- Add optional fields to vendor_invite_candidates
ALTER TABLE "vendor_invite_candidates" 
  ADD COLUMN "primaryDomain" TEXT,
  ADD COLUMN "lastSeenAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "vendor_invite_contacts_candidateId_email_key" ON "vendor_invite_contacts"("candidateId", "email");

-- CreateIndex
CREATE INDEX "vendor_invite_contacts_candidateId_idx" ON "vendor_invite_contacts"("candidateId");

-- CreateIndex
CREATE INDEX "vendor_invite_contacts_email_idx" ON "vendor_invite_contacts"("email");

-- CreateIndex
CREATE INDEX "vendor_invite_contacts_domain_idx" ON "vendor_invite_contacts"("domain");

-- CreateIndex
CREATE INDEX "vendor_invite_contacts_designerId_idx" ON "vendor_invite_contacts"("designerId");

-- CreateIndex
CREATE INDEX "vendor_invite_contacts_createdAt_idx" ON "vendor_invite_contacts"("createdAt");

-- AddForeignKey
ALTER TABLE "vendor_invite_contacts" ADD CONSTRAINT "vendor_invite_contacts_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "vendor_invite_candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_invite_contacts" ADD CONSTRAINT "vendor_invite_contacts_designerId_fkey" FOREIGN KEY ("designerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_invite_contacts" ADD CONSTRAINT "vendor_invite_contacts_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Migrate existing repEmail/repName to contacts (if they exist)
-- Note: This is a one-time migration. Going forward, use VendorInviteContact rows only.
INSERT INTO "vendor_invite_contacts" (
  "id",
  "createdAt",
  "candidateId",
  "email",
  "name",
  "domain",
  "designerId",
  "projectId",
  "source"
)
SELECT 
  gen_random_uuid(),
  "createdAt",
  "id" as "candidateId",
  "repEmail" as "email",
  "repName" as "name",
  CASE 
    WHEN "repEmail" LIKE '%@%' THEN LOWER(SPLIT_PART("repEmail", '@', 2))
    ELSE NULL
  END as "domain",
  "firstSeenByDesignerId" as "designerId",
  "firstSeenInProjectId" as "projectId",
  'LEGACY' as "source"
FROM "vendor_invite_candidates"
WHERE "repEmail" IS NOT NULL 
  AND "repEmail" != ''
  AND NOT EXISTS (
    SELECT 1 FROM "vendor_invite_contacts" 
    WHERE "vendor_invite_contacts"."candidateId" = "vendor_invite_candidates"."id"
      AND "vendor_invite_contacts"."email" = LOWER(TRIM("vendor_invite_candidates"."repEmail"))
  );








