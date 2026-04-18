-- DesignerBrandProfile model: per-designer branding (logo, colors, fonts, website).
-- Authored from prod introspection of designer_brand_profiles; idempotent.

CREATE TABLE IF NOT EXISTS "designer_brand_profiles" (
    "id" TEXT NOT NULL,
    "designerId" TEXT NOT NULL,
    "logoImageUrl" TEXT,
    "primaryColor" TEXT,
    "secondaryColor" TEXT,
    "accentColor" TEXT,
    "fontHeading" TEXT,
    "fontBody" TEXT,
    "websiteUrl" TEXT,
    "setupCompletedAt" TIMESTAMP,
    "setupSkippedAt" TIMESTAMP,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "designer_brand_profiles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "designer_brand_profiles_designerId_key" ON "designer_brand_profiles"("designerId");

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'designer_brand_profiles_designerId_fkey') THEN
        ALTER TABLE "designer_brand_profiles" ADD CONSTRAINT "designer_brand_profiles_designerId_fkey" FOREIGN KEY ("designerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
