-- CreateEnum
CREATE TYPE "RelationshipTier" AS ENUM ('FOLLOW', 'CONNECTION', 'FIRM_CONNECTION');

-- CreateTable
CREATE TABLE "user_relationships" (
    "id" TEXT NOT NULL,
    "followerId" TEXT NOT NULL,
    "followingId" TEXT NOT NULL,
    "tier" "RelationshipTier" NOT NULL DEFAULT 'FOLLOW',
    "tierUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isMutual" BOOLEAN NOT NULL DEFAULT false,
    "qrExchangeCount" INTEGER NOT NULL DEFAULT 0,
    "messageCount" INTEGER NOT NULL DEFAULT 0,
    "specExchangeCount" INTEGER NOT NULL DEFAULT 0,
    "sharedProjectCount" INTEGER NOT NULL DEFAULT 0,
    "tagOverlapCount" INTEGER NOT NULL DEFAULT 0,
    "coEventCount" INTEGER NOT NULL DEFAULT 0,
    "lastActivityAt" TIMESTAMP(3),
    "engagementScore" DOUBLE PRECISION,
    "engagementUpdatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_relationships_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_relationships_followerId_followingId_key" ON "user_relationships"("followerId", "followingId");

-- CreateIndex
CREATE INDEX "user_relationships_followingId_idx" ON "user_relationships"("followingId");

-- CreateIndex
CREATE INDEX "user_relationships_tier_idx" ON "user_relationships"("tier");

-- AddForeignKey
ALTER TABLE "user_relationships" ADD CONSTRAINT "user_relationships_followerId_fkey" FOREIGN KEY ("followerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_relationships" ADD CONSTRAINT "user_relationships_followingId_fkey" FOREIGN KEY ("followingId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
