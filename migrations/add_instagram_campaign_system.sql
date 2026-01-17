-- Instagram Campaign System Migration
-- Run this SQL directly in your PostgreSQL database

-- Create instagram_campaigns table
CREATE TABLE IF NOT EXISTS "instagram_campaigns" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "preset" TEXT NOT NULL,
    "totalPosts" INTEGER NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "downloadUrl" TEXT,
    "formats" TEXT[] NOT NULL,
    "includeRooms" BOOLEAN NOT NULL DEFAULT true,
    "includeProducts" BOOLEAN NOT NULL DEFAULT true,
    "includeQuotes" BOOLEAN NOT NULL DEFAULT true,
    "includeDetails" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "instagram_campaigns_pkey" PRIMARY KEY ("id")
);

-- Create instagram_campaign_posts table
CREATE TABLE IF NOT EXISTS "instagram_campaign_posts" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "postType" TEXT NOT NULL,
    "sequenceNum" INTEGER NOT NULL,
    "title" TEXT,
    "caption" TEXT NOT NULL,
    "hashtags" TEXT[] NOT NULL,
    "format" TEXT[] NOT NULL,
    "imageIds" TEXT[] NOT NULL,
    "productIds" TEXT[] NOT NULL,
    "roomName" TEXT,
    "fileUrls" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "instagram_campaign_posts_pkey" PRIMARY KEY ("id")
);

-- Create indexes
CREATE INDEX IF NOT EXISTS "instagram_campaigns_projectId_idx" ON "instagram_campaigns"("projectId");
CREATE INDEX IF NOT EXISTS "instagram_campaign_posts_campaignId_sequenceNum_idx" ON "instagram_campaign_posts"("campaignId", "sequenceNum");

-- Add foreign key constraints
ALTER TABLE "instagram_campaigns"
ADD CONSTRAINT "instagram_campaigns_projectId_fkey"
FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "instagram_campaign_posts"
ADD CONSTRAINT "instagram_campaign_posts_campaignId_fkey"
FOREIGN KEY ("campaignId") REFERENCES "instagram_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create trigger to update updatedAt timestamp
CREATE OR REPLACE FUNCTION update_instagram_campaigns_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_instagram_campaigns_updated_at_trigger
BEFORE UPDATE ON "instagram_campaigns"
FOR EACH ROW
EXECUTE FUNCTION update_instagram_campaigns_updated_at();
