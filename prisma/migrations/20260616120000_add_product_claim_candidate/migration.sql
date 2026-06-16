-- Product Tag Lifecycle Phase 3: vendor review queue backing.
-- One row per (product, organization) claim candidate. matchType "DOMAIN" rows
-- are recorded CONFIRMED on Phase 2 turnover (audit trail); "BRAND" rows are
-- PENDING for vendor review. ADD-only, idempotent.

CREATE TABLE IF NOT EXISTS "product_claim_candidates" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "matchType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_claim_candidates_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "product_claim_candidates_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "product_claim_candidates_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "product_claim_candidates_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "product_claim_candidates_productId_organizationId_key" ON "product_claim_candidates"("productId", "organizationId");
CREATE INDEX IF NOT EXISTS "product_claim_candidates_organizationId_status_idx" ON "product_claim_candidates"("organizationId", "status");
