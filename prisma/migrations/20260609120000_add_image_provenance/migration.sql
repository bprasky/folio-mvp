-- Image provenance gate (spec 17_IMAGE_PROVENANCE_GATE). ADD-only, idempotent.
-- Every existing product row defaults to VENDOR_REFERENCE / INTERNAL, so all
-- legacy rows start suppressed on public surfaces (the fail-safe backfill).

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ImageSource') THEN
    CREATE TYPE "ImageSource" AS ENUM
      ('VENDOR_REFERENCE','VENDOR_LICENSED','DESIGNER_ORIGINAL','FOLIO_COMMISSIONED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DisplayScope') THEN
    CREATE TYPE "DisplayScope" AS ENUM ('INTERNAL','PUBLIC');
  END IF;
END $$;

ALTER TABLE "products"
  ADD COLUMN IF NOT EXISTS "imageSource" "ImageSource" NOT NULL DEFAULT 'VENDOR_REFERENCE';
ALTER TABLE "products"
  ADD COLUMN IF NOT EXISTS "displayScope" "DisplayScope" NOT NULL DEFAULT 'INTERNAL';
