-- CreateTable: DesignerBio
CREATE TABLE "designer_bios" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "scrapedData" JSONB,
    "scrapedAt" TIMESTAMP(3),
    "sourceUrl" TEXT,
    "interviewAnswers" JSONB,
    "interviewCompletedAt" TIMESTAMP(3),
    "folioBio" TEXT,
    "bioGeneratedAt" TIMESTAMP(3),
    "bioEditedByUser" BOOLEAN NOT NULL DEFAULT false,
    "primaryPhotoUrl" TEXT,
    "secondaryPhotoUrl" TEXT,
    "teamPhotoUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'empty',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "designer_bios_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ProfileQA
CREATE TABLE "profile_qas" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT,
    "category" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "triggerType" TEXT,
    "triggerEntityId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "displayOrder" INTEGER,
    "answeredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "profile_qas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "designer_bios_userId_key" ON "designer_bios"("userId");

-- CreateIndex
CREATE INDEX "profile_qas_userId_status_idx" ON "profile_qas"("userId", "status");

-- CreateIndex
CREATE INDEX "profile_qas_userId_displayOrder_idx" ON "profile_qas"("userId", "displayOrder");

-- AddForeignKey
ALTER TABLE "designer_bios" ADD CONSTRAINT "designer_bios_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile_qas" ADD CONSTRAINT "profile_qas_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
