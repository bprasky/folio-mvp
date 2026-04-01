-- Phase 5: Email Integration & Contact Import

-- New enums
CREATE TYPE "EmailThreadStatus" AS ENUM ('SENT', 'REPLIED', 'PARSED', 'CONFIRMED', 'CLOSED');
CREATE TYPE "EmailDirection" AS ENUM ('OUTBOUND', 'INBOUND');
CREATE TYPE "ParsingStatus" AS ENUM ('PENDING', 'PARSED', 'CONFIRMED', 'REJECTED');
CREATE TYPE "ContactMatchConfidence" AS ENUM ('HIGH', 'MEDIUM', 'LOW', 'UNMATCHED');
CREATE TYPE "ContactSource" AS ENUM ('GOOGLE', 'MICROSOFT', 'CSV_UPLOAD', 'VCF_UPLOAD');
CREATE TYPE "ImportStatus" AS ENUM ('PROCESSING', 'AWAITING_REVIEW', 'COMPLETED', 'FAILED');

-- Add FOLIO_EMAIL to ConversationContext
ALTER TYPE "ConversationContext" ADD VALUE 'FOLIO_EMAIL';

-- User email preference fields
ALTER TABLE "users" ADD COLUMN "emailSendPreference" TEXT DEFAULT 'folio';
ALTER TABLE "users" ADD COLUMN "signatureIncludeFirm" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "users" ADD COLUMN "signatureIncludePhone" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "users" ADD COLUMN "signatureIncludeProfile" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "users" ADD COLUMN "signatureIncludeEmail" BOOLEAN NOT NULL DEFAULT false;

-- ProxyAddress table
CREATE TABLE "proxy_addresses" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "proxy_addresses_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "proxy_addresses_userId_key" ON "proxy_addresses"("userId");
CREATE UNIQUE INDEX "proxy_addresses_address_key" ON "proxy_addresses"("address");
ALTER TABLE "proxy_addresses" ADD CONSTRAINT "proxy_addresses_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- EmailThread table
CREATE TABLE "email_threads" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "conversationId" TEXT,
    "actionType" TEXT,
    "productId" TEXT,
    "projectId" TEXT,
    "pendingActionId" TEXT,
    "recipientEmail" TEXT NOT NULL,
    "recipientName" TEXT,
    "vendorOrgId" TEXT,
    "status" "EmailThreadStatus" NOT NULL DEFAULT 'SENT',
    "subject" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "email_threads_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "email_threads_conversationId_key" ON "email_threads"("conversationId");
CREATE INDEX "email_threads_userId_idx" ON "email_threads"("userId");
CREATE INDEX "email_threads_recipientEmail_idx" ON "email_threads"("recipientEmail");
CREATE INDEX "email_threads_status_idx" ON "email_threads"("status");
ALTER TABLE "email_threads" ADD CONSTRAINT "email_threads_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "email_threads" ADD CONSTRAINT "email_threads_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- EmailMessage table
CREATE TABLE "email_messages" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "direction" "EmailDirection" NOT NULL,
    "fromAddress" TEXT NOT NULL,
    "toAddress" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "textBody" TEXT NOT NULL,
    "htmlBody" TEXT,
    "resendMessageId" TEXT,
    "inboundId" TEXT,
    "parsedData" JSONB,
    "parsingStatus" "ParsingStatus",
    "sentAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "email_messages_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "email_messages_threadId_idx" ON "email_messages"("threadId");
CREATE INDEX "email_messages_resendMessageId_idx" ON "email_messages"("resendMessageId");
ALTER TABLE "email_messages" ADD CONSTRAINT "email_messages_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "email_threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ContactImportJob table
CREATE TABLE "contact_import_jobs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "source" "ContactSource" NOT NULL,
    "status" "ImportStatus" NOT NULL DEFAULT 'PROCESSING',
    "totalContacts" INTEGER NOT NULL DEFAULT 0,
    "filteredCount" INTEGER NOT NULL DEFAULT 0,
    "matchedCount" INTEGER NOT NULL DEFAULT 0,
    "importedCount" INTEGER NOT NULL DEFAULT 0,
    "oauthProvider" TEXT,
    "syncToken" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "contact_import_jobs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "contact_import_jobs_userId_idx" ON "contact_import_jobs"("userId");
ALTER TABLE "contact_import_jobs" ADD CONSTRAINT "contact_import_jobs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- DesignerContact table
CREATE TABLE "designer_contacts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "importSourceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "company" TEXT,
    "title" TEXT,
    "vendorOrgId" TEXT,
    "vendorName" TEXT,
    "matchConfidence" "ContactMatchConfidence",
    "isPreferredRep" BOOLEAN NOT NULL DEFAULT false,
    "repShadowId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "designer_contacts_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "designer_contacts_userId_email_key" ON "designer_contacts"("userId", "email");
CREATE INDEX "designer_contacts_userId_idx" ON "designer_contacts"("userId");
CREATE INDEX "designer_contacts_vendorOrgId_idx" ON "designer_contacts"("vendorOrgId");
CREATE INDEX "designer_contacts_email_idx" ON "designer_contacts"("email");
ALTER TABLE "designer_contacts" ADD CONSTRAINT "designer_contacts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "designer_contacts" ADD CONSTRAINT "designer_contacts_importSourceId_fkey" FOREIGN KEY ("importSourceId") REFERENCES "contact_import_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "designer_contacts" ADD CONSTRAINT "designer_contacts_vendorOrgId_fkey" FOREIGN KEY ("vendorOrgId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "designer_contacts" ADD CONSTRAINT "designer_contacts_repShadowId_fkey" FOREIGN KEY ("repShadowId") REFERENCES "rep_shadow_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add context index to conversations for email thread filtering
CREATE INDEX "conversations_context_idx" ON "conversations"("context");
