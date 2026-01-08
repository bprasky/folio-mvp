-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable - Add account approval fields to users
-- Default to APPROVED so existing users are not locked out
ALTER TABLE "users" ADD COLUMN "accountStatus" "AccountStatus" NOT NULL DEFAULT 'APPROVED';
ALTER TABLE "users" ADD COLUMN "approvedAt" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "approvedBy" TEXT;
ALTER TABLE "users" ADD COLUMN "rejectionReason" TEXT;
ALTER TABLE "users" ADD COLUMN "applicationNote" TEXT;
ALTER TABLE "users" ADD COLUMN "onboardingCompletedAt" TIMESTAMP(3);

-- CreateTable - ImpersonationLog for audit trail
CREATE TABLE "impersonation_logs" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "impersonation_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "impersonation_logs_adminId_idx" ON "impersonation_logs"("adminId");

-- CreateIndex
CREATE INDEX "impersonation_logs_targetUserId_idx" ON "impersonation_logs"("targetUserId");

-- AddForeignKey
ALTER TABLE "impersonation_logs" ADD CONSTRAINT "impersonation_logs_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "impersonation_logs" ADD CONSTRAINT "impersonation_logs_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
