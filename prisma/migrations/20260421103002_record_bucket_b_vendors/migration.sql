-- Phase 5H2: record existing vendors in migration history.
-- Table was created hand-managed prior to reliable migration system.
-- CREATE TABLE IF NOT EXISTS for idempotency — prod is untouched; shadow DB gets the table on replay.
-- Column types lifted from information_schema.columns against prod (2026-04-21).

CREATE TABLE IF NOT EXISTS "vendors" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "name" TEXT NOT NULL,
    "website" TEXT,
    "logoUrl" TEXT,
    "primaryEmail" TEXT,
    "country" TEXT,
    "city" TEXT,
    "userId" TEXT
    ,
    CONSTRAINT "vendors_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "vendors_primaryEmail_key" ON public.vendors USING btree ("primaryEmail");

