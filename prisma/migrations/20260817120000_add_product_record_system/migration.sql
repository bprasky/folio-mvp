-- Product Record System (spec 22_PRODUCT_RECORD). ADD-only, idempotent.
--
-- The Product Record is the Product entity at Corpus scope in spec 21: many
-- projects against one product, where a project Super-Article is many
-- contributors against one project. Same block library, different join key.
-- What this migration adds is the storage for the gate and the commission.
--
-- ONE migration for Phases A through E rather than five. The Phase C-E tables
-- land here with no readers, which is deliberate — five migrations against the
-- same tables is five chances to get the bookkeeping wrong, and that is exactly
-- the debt Phases 1-5E spent weeks unwinding. Phase C is blocked upstream on the
-- canonical interviewer module, not on schema.
--
-- Nothing here is destructive. product_testimonials and shop_products are
-- untouched: spec 22 subsumes ProductTestimonial for NEW volunteer quotes by
-- routing them to supplemental_quotes.testimonyClass, and existing rows keep
-- serving the Shop surface until a deliberate later migration moves them.

-- ── Enums ───────────────────────────────────────────────────────────────────
-- CREATE TYPE has no IF NOT EXISTS in Postgres, so the pg_type guard is the
-- idempotent form. Same pattern as 20260609120000_add_image_provenance.

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ProductRecordTier') THEN
    CREATE TYPE "ProductRecordTier" AS ENUM ('LISTING','RECORD','ARTICLE');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'VendorRecordState') THEN
    CREATE TYPE "VendorRecordState" AS ENUM ('TAGGED','CLAIMED','COLLABORATING');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CollaborationRequestStatus') THEN
    CREATE TYPE "CollaborationRequestStatus" AS ENUM
      ('PENDING','DECLINED','EXPIRED','SUBMITTED_BELOW_FLOOR','COMPLETED_WITHHELD','COMPLETED_PUBLISHED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TestimonyClass') THEN
    CREATE TYPE "TestimonyClass" AS ENUM ('VOLUNTEER','COMMISSIONED');
  END IF;
END $$;

-- ── products: record tier and the coverage cache ────────────────────────────
-- Every existing product defaults to LISTING, which reads correctly on all of
-- them: tier is earned from specification events, and no row has been evaluated
-- yet. recordPublishedAt stays NULL for the same reason.
--
-- The three counts default to 0 rather than being backfilled. They are a CACHE,
-- not the truth — getProductRecord computes coverage live from product_tags and
-- never reads these columns, so a zero here can only under-report a list
-- surface, never produce a wrong Record. A backfill that walked every product's
-- tags at migration time would be a long-running statement buying a number that
-- the first cache refresh recomputes anyway.
--
-- No index on any of them. Nothing joins on these; the claim-email cohort query
-- is an ordered scan over a table this size, and an index would cost writes on
-- every tag creation to buy nothing.

ALTER TABLE "products"
  ADD COLUMN IF NOT EXISTS "recordTier" "ProductRecordTier" NOT NULL DEFAULT 'LISTING',
  ADD COLUMN IF NOT EXISTS "recordPublishedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "specifierCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "projectCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "testimonyCount" INTEGER NOT NULL DEFAULT 0;

-- ── supplemental_quotes: testimony class ────────────────────────────────────
-- Volunteer and commissioned content are distinct block classes with distinct
-- gates, and conflating them leaks the gate. VOLUNTEER is the correct default on
-- every existing row: no interview elicited any of them, and none was paid for.
--
-- collaborationRequestId is a bare column with no FK constraint, matching the
-- spec's model. collaboration_requests has no rows and no writers until Phase C;
-- the constraint lands with the code that can populate it, rather than
-- constraining a column nothing writes.
--
-- No index. Commissioned testimony is counted per product through
-- productTagId -> product_tags.productId, which supplemental_quotes_productTagId_idx
-- already covers. An index here would be one added for symmetry.

ALTER TABLE "supplemental_quotes"
  ADD COLUMN IF NOT EXISTS "testimonyClass" "TestimonyClass" NOT NULL DEFAULT 'VOLUNTEER',
  ADD COLUMN IF NOT EXISTS "collaborationRequestId" TEXT;

-- ── vendor_product_claims (Phase B) ─────────────────────────────────────────
-- Absence of a row is TAGGED. There is no TAGGED row to write, because tagging
-- is what designers do and claiming is what vendors do; a vendor who never
-- claims should not require a write to be in their default state.
--
-- freeRequestConsumedAt returns to NULL on decline or expiry. A lapsed free
-- request must not be a dead end — it is the entire conversion moment.

CREATE TABLE IF NOT EXISTS "vendor_product_claims" (
  "id"                    TEXT NOT NULL,
  "organizationId"        TEXT NOT NULL,
  "productId"             TEXT NOT NULL,
  "state"                 "VendorRecordState" NOT NULL DEFAULT 'CLAIMED',
  "claimedAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "freeRequestGrantedAt"  TIMESTAMP(3),
  "freeRequestConsumedAt" TIMESTAMP(3),
  CONSTRAINT "vendor_product_claims_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "vendor_product_claims_organizationId_productId_key"
  ON "vendor_product_claims" ("organizationId", "productId");
CREATE INDEX IF NOT EXISTS "vendor_product_claims_productId_idx"
  ON "vendor_product_claims" ("productId");

-- ── collaboration_requests (Phase C) ────────────────────────────────────────
-- quotedPriceCents and designerTierAtQuote are frozen at request time, not
-- looked up at billing time. Price scales on influence and a designer's tier
-- moves; billing a request at a rate the vendor never agreed to is the failure
-- this denormalization prevents.
--
-- (status, expiresAt) carries the expiry sweep: reminders at day 7 and 17, and
-- the grant return at 21.

CREATE TABLE IF NOT EXISTS "collaboration_requests" (
  "id"                  TEXT NOT NULL,
  "organizationId"      TEXT NOT NULL,
  "productId"           TEXT NOT NULL,
  "designerId"          TEXT NOT NULL,
  "projectPostId"       TEXT,
  "status"              "CollaborationRequestStatus" NOT NULL DEFAULT 'PENDING',
  "isFreeGrant"         BOOLEAN NOT NULL DEFAULT false,
  "quotedPriceCents"    INTEGER NOT NULL,
  "designerTierAtQuote" TEXT NOT NULL,
  "expiresAt"           TIMESTAMP(3) NOT NULL,
  "respondedAt"         TIMESTAMP(3),
  "publishedAt"         TIMESTAMP(3),
  "billedAt"            TIMESTAMP(3),
  "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"           TIMESTAMP(3) NOT NULL,
  CONSTRAINT "collaboration_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "collaboration_requests_organizationId_idx"
  ON "collaboration_requests" ("organizationId");
CREATE INDEX IF NOT EXISTS "collaboration_requests_productId_idx"
  ON "collaboration_requests" ("productId");
CREATE INDEX IF NOT EXISTS "collaboration_requests_designerId_status_idx"
  ON "collaboration_requests" ("designerId", "status");
CREATE INDEX IF NOT EXISTS "collaboration_requests_status_expiresAt_idx"
  ON "collaboration_requests" ("status", "expiresAt");

-- ── private_product_signals (Phase C) ───────────────────────────────────────
-- The private half of the dual output. Never rendered, and never an input to
-- targeting or recommendation. That firewall cannot be expressed as a
-- constraint, so it is enforced by scripts/check-product-record-invariants.ts,
-- which fails the build if any targeting, recommendation, or boost module reads
-- this table.
--
-- One signal per request: the unique on collaborationRequestId is the structural
-- statement that a vendor buys one payload per request and cannot accumulate
-- more by re-reading.

CREATE TABLE IF NOT EXISTS "private_product_signals" (
  "id"                     TEXT NOT NULL,
  "collaborationRequestId" TEXT NOT NULL,
  "productId"              TEXT NOT NULL,
  "designerId"             TEXT NOT NULL,
  "qualityScore"           INTEGER,
  "failureMode"            TEXT,
  "leadTimeDays"           INTEGER,
  "finishConsistency"      TEXT,
  "freightCondition"       TEXT,
  "repResponsiveness"      TEXT,
  "reorderIntent"          TEXT,
  "routedFromPublic"       BOOLEAN NOT NULL DEFAULT false,
  "createdAt"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "private_product_signals_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "private_product_signals_collaborationRequestId_key"
  ON "private_product_signals" ("collaborationRequestId");
CREATE INDEX IF NOT EXISTS "private_product_signals_productId_idx"
  ON "private_product_signals" ("productId");

-- ── commission_ledger_entries (Phase D) ─────────────────────────────────────
-- fundedBy is the load-bearing column. Folio funds the effectiveness bonus and
-- the commission on the free request; the vendor funds base and license only. A
-- vendor paying extra for feedback Folio graded is indefensible regardless of
-- how the grading works, and a ledger that cannot say who paid cannot prove it
-- did not happen.
--
-- amountCents is an INTEGER of cents, deliberately not a float. See
-- memory/migration_priceusd_double_techdebt.md for what the other choice cost.

CREATE TABLE IF NOT EXISTS "commission_ledger_entries" (
  "id"                     TEXT NOT NULL,
  "collaborationRequestId" TEXT,
  "licenseGrantId"         TEXT,
  "designerId"             TEXT NOT NULL,
  "kind"                   TEXT NOT NULL,
  "amountCents"            INTEGER NOT NULL,
  "fundedBy"               TEXT NOT NULL,
  "payoutMethod"           TEXT NOT NULL,
  "stripeTransferId"       TEXT,
  "gradedAt"               TIMESTAMP(3),
  "evidenceDensityScore"   INTEGER,
  "paidAt"                 TIMESTAMP(3),
  "createdAt"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "commission_ledger_entries_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "commission_ledger_entries_designerId_idx"
  ON "commission_ledger_entries" ("designerId");
CREATE INDEX IF NOT EXISTS "commission_ledger_entries_kind_paidAt_idx"
  ON "commission_ledger_entries" ("kind", "paidAt");

-- ── license_grants (Phase E) ────────────────────────────────────────────────
-- expiresAt is stored, not derived from grantedAt + termMonths. A lapsed vendor's
-- already-exported material is honored for the full term, so the expiry a
-- designer was told about at distribution time must survive any later change to
-- the default term.

CREATE TABLE IF NOT EXISTS "license_grants" (
  "id"             TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "productId"      TEXT NOT NULL,
  "scope"          TEXT NOT NULL,
  "termMonths"     INTEGER NOT NULL DEFAULT 12,
  "grantedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "license_grants_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "license_grants_organizationId_idx"
  ON "license_grants" ("organizationId");
CREATE INDEX IF NOT EXISTS "license_grants_productId_idx"
  ON "license_grants" ("productId");

-- ── Foreign keys ────────────────────────────────────────────────────────────
-- Only vendor_product_claims declares relations in schema.prisma, so only it
-- gets constraints. ADD CONSTRAINT has no IF NOT EXISTS, so each is guarded on
-- pg_constraint. See memory/migration_phase5h2_missing_fk_constraints.md for
-- why the guard is written out rather than assumed.
--
-- ON DELETE RESTRICT is Prisma's default for a required relation and is the
-- right behavior here: a product with an active vendor claim, or an org holding
-- claims, should not disappear silently underneath the Record.

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'vendor_product_claims_organizationId_fkey'
  ) THEN
    ALTER TABLE "vendor_product_claims"
      ADD CONSTRAINT "vendor_product_claims_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "organizations"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'vendor_product_claims_productId_fkey'
  ) THEN
    ALTER TABLE "vendor_product_claims"
      ADD CONSTRAINT "vendor_product_claims_productId_fkey"
      FOREIGN KEY ("productId") REFERENCES "products"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
