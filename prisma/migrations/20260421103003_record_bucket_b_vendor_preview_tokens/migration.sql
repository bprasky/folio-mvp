-- Phase 5H2: record existing vendor_preview_tokens in migration history.
-- Table was created hand-managed prior to reliable migration system.
-- CREATE TABLE IF NOT EXISTS for idempotency — prod is untouched; shadow DB gets the table on replay.
-- Column types lifted from information_schema.columns against prod (2026-04-21).

CREATE TABLE IF NOT EXISTS "vendor_preview_tokens" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "vendorId" TEXT,
    "productId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "usedAt" TIMESTAMP(3)
    ,
    CONSTRAINT "vendor_preview_tokens_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "vendor_preview_tokens_expiresAt_idx" ON public.vendor_preview_tokens USING btree ("expiresAt");
CREATE INDEX IF NOT EXISTS vendor_preview_tokens_token_idx ON public.vendor_preview_tokens USING btree (token);
CREATE UNIQUE INDEX IF NOT EXISTS vendor_preview_tokens_token_key ON public.vendor_preview_tokens USING btree (token);

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vendor_preview_tokens_productId_fkey') THEN
        ALTER TABLE "vendor_preview_tokens" ADD CONSTRAINT "vendor_preview_tokens_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vendor_preview_tokens_projectId_fkey') THEN
        ALTER TABLE "vendor_preview_tokens" ADD CONSTRAINT "vendor_preview_tokens_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vendor_preview_tokens_vendorId_fkey') THEN
        ALTER TABLE "vendor_preview_tokens" ADD CONSTRAINT "vendor_preview_tokens_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
