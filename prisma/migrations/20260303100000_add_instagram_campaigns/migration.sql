-- Fix phantom models: schema.prisma declares InstagramCampaign and InstagramCampaignPost
-- but no migration folder creates their tables. Authored from schema.prisma alone
-- (no prod introspection — tables do not exist). Inserted between Deploy #3 and Deploy #4
-- of the Phase 4 convergence so the IG feature surface is complete end-to-end.
--
-- Idempotent: safe to re-run. No destructive operations. DateTime columns use TIMESTAMPTZ
-- to match the adjacent 20260303000000_add_instagram_exports migration and keep the IG
-- feature surface internally consistent. expiresAt in particular represents a real-world
-- 30-day cutoff, so UTC-anchored timestamp semantics are the correct choice.

-- ================================================================
-- instagram_campaigns
-- ================================================================
CREATE TABLE IF NOT EXISTS "instagram_campaigns" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "preset" TEXT NOT NULL,
    "totalPosts" INTEGER NOT NULL,
    "generatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ NOT NULL,
    "downloadUrl" TEXT,
    "formats" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "includeRooms" BOOLEAN NOT NULL DEFAULT true,
    "includeProducts" BOOLEAN NOT NULL DEFAULT true,
    "includeQuotes" BOOLEAN NOT NULL DEFAULT true,
    "includeDetails" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "instagram_campaigns_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "instagram_campaigns_projectId_idx" ON "instagram_campaigns"("projectId");

-- ================================================================
-- instagram_campaign_posts
-- ================================================================
CREATE TABLE IF NOT EXISTS "instagram_campaign_posts" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "postType" TEXT NOT NULL,
    "sequenceNum" INTEGER NOT NULL,
    "title" TEXT,
    "caption" TEXT NOT NULL,
    "hashtags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "format" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "imageIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "productIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "roomName" TEXT,
    "fileUrls" JSONB,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "instagram_campaign_posts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "instagram_campaign_posts_campaignId_sequenceNum_idx"
    ON "instagram_campaign_posts"("campaignId", "sequenceNum");

-- ================================================================
-- Foreign keys (conname existence guards)
-- ================================================================
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'instagram_campaigns_projectId_fkey') THEN
        ALTER TABLE "instagram_campaigns"
            ADD CONSTRAINT "instagram_campaigns_projectId_fkey"
            FOREIGN KEY ("projectId") REFERENCES "projects"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'instagram_campaign_posts_campaignId_fkey') THEN
        ALTER TABLE "instagram_campaign_posts"
            ADD CONSTRAINT "instagram_campaign_posts_campaignId_fkey"
            FOREIGN KEY ("campaignId") REFERENCES "instagram_campaigns"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
