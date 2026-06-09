-- Scrape instrumentation (spec 17 Phase 1). One row per scrape attempt so the
-- per-domain failure mode (render vs block vs captcha) is observable instead of
-- lost to console.error. ADD-only, fully idempotent. No foreign keys: the join
-- ids are plain and nullable so a write never blocks the scrape path.

DO $$ BEGIN
  CREATE TYPE "ScrapeConsumer" AS ENUM ('VENDOR_WIZARD', 'IMPORT_IMAGE', 'IMPORT_WEBSITE', 'DESIGNER_BIO', 'PRODUCT_SCRAPE');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "ScrapeEndpoint" AS ENUM ('CONTENT', 'FUNCTION', 'SMART_SCRAPE', 'UNBLOCK', 'BQL', 'DIRECT_FETCH');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "ScrapeEscalation" AS ENUM ('NONE', 'BASIC', 'STEALTH', 'RESIDENTIAL', 'UNBLOCK', 'BQL_SOLVE');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "ScrapeOutcome" AS ENUM ('RENDERED_OK', 'THIN_CONTENT', 'BLOCKED_403', 'BLOCKED_429', 'CHALLENGE_PAGE', 'CAPTCHA_PRESENT', 'BROWSERLESS_ERROR', 'DIRECT_FETCH_FALLBACK', 'TIMEOUT');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "ScrapeAttempt" (
  "id"              TEXT NOT NULL,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "url"             TEXT NOT NULL,
  "domain"          TEXT NOT NULL,
  "consumer"        "ScrapeConsumer" NOT NULL,
  "endpoint"        "ScrapeEndpoint" NOT NULL,
  "escalationLevel" "ScrapeEscalation" NOT NULL,
  "targetStatus"    INTEGER,
  "outcome"         "ScrapeOutcome" NOT NULL,
  "durationMs"      INTEGER NOT NULL,
  "importSessionId" TEXT,
  "productId"       TEXT,
  CONSTRAINT "ScrapeAttempt_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ScrapeAttempt_domain_outcome_idx" ON "ScrapeAttempt"("domain", "outcome");
CREATE INDEX IF NOT EXISTS "ScrapeAttempt_createdAt_idx" ON "ScrapeAttempt"("createdAt");
