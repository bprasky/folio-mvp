-- Phase 2: Communication Layer

-- Add category and structuredData to conversations
ALTER TABLE "conversations" ADD COLUMN "category" TEXT NOT NULL DEFAULT 'GENERAL';
ALTER TABLE "conversations" ADD COLUMN "structuredData" JSONB;

-- CreateIndex for filtering inbox by category
CREATE INDEX "conversations_category_idx" ON "conversations"("category");
CREATE INDEX "conversations_recipientOrgId_category_idx" ON "conversations"("recipientOrgId", "category");

-- CreateTable: pending_actions
CREATE TABLE "pending_actions" (
    "id" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "targetEmail" TEXT NOT NULL,
    "targetName" TEXT NOT NULL,
    "targetOrgId" TEXT,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "inviteSentAt" TIMESTAMP(3),
    "reminderSentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "expiredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pending_actions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pending_actions_targetEmail_idx" ON "pending_actions"("targetEmail");
CREATE INDEX "pending_actions_status_idx" ON "pending_actions"("status");
CREATE INDEX "pending_actions_senderId_idx" ON "pending_actions"("senderId");

-- AddForeignKey
ALTER TABLE "pending_actions" ADD CONSTRAINT "pending_actions_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pending_actions" ADD CONSTRAINT "pending_actions_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
