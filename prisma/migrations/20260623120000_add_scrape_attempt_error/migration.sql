-- Scrape instrumentation: persist failure detail. Until now a failed attempt
-- recorded only its outcome enum (e.g. BROWSERLESS_ERROR) with no message, so
-- the cause was opaque. Add a nullable error column the recorder fills with the
-- caught error text (and any parsed GraphQL error from the bql path). ADD-only,
-- fully idempotent, no destructive DDL.

ALTER TABLE "ScrapeAttempt" ADD COLUMN IF NOT EXISTS "error" TEXT;
