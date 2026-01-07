-- CreateEnum
CREATE TYPE "PostStatus" AS ENUM ('DRAFT', 'REVIEW', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "PostVariant" AS ENUM ('PROJECT_FEATURE', 'MATERIAL_STUDY', 'METHOD', 'DESIGNER_PROFILE', 'EVENT_ESSAY');

-- CreateTable
CREATE TABLE "project_posts" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "status" "PostStatus" NOT NULL DEFAULT 'DRAFT',
    "variant" "PostVariant" NOT NULL DEFAULT 'PROJECT_FEATURE',
    "slug" TEXT NOT NULL,
    "heroAssetId" TEXT,
    "excerpt" TEXT,
    "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "expandedBlocks" JSONB,
    "provenance" JSONB,
    "credits" JSONB,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_posts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "project_posts_projectId_key" ON "project_posts"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "project_posts_slug_key" ON "project_posts"("slug");

-- AddForeignKey
ALTER TABLE "project_posts" ADD CONSTRAINT "project_posts_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
