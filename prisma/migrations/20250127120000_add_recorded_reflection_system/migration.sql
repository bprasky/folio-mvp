-- Recorded Reflection System Migration
-- Adds Interview sessions, transcripts, quote highlights, vendor boost requests, media assets.

DO $$ BEGIN
    CREATE TYPE "InterviewSessionStatus" AS ENUM (
      'DRAFT', 'UPLOADED', 'TRANSCRIBING', 'TRANSCRIBED', 'EXTRACTING', 'EXTRACTED',
      'CLIPPING', 'READY', 'PUBLISHED', 'ARCHIVED'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE "InterviewMode" AS ENUM ('AUDIO', 'VIDEO');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE "QuoteUseCase" AS ENUM ('EDITORIAL_PULLQUOTE', 'PRODUCT_PAGE_INSIGHT', 'SOCIAL_CLIP_HOOK');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE "VendorBoostRequestStatus" AS ENUM (
      'PENDING', 'ACCEPTED', 'COMPLETED', 'DECLINED', 'EXPIRED', 'CANCELLED'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "media_assets" (
  "id" TEXT NOT NULL,
  "storageKey" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "durationMs" INTEGER,
  "fileSizeBytes" INTEGER,
  "waveformData" JSONB,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "media_assets_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "media_assets_storageKey_idx" ON "media_assets"("storageKey");

CREATE TABLE IF NOT EXISTS "interview_sessions" (
  "id" TEXT NOT NULL,
  "createdByUserId" TEXT NOT NULL,
  "projectId" TEXT,
  "productId" TEXT,
  "vendorBoostRequestId" TEXT,
  "vendorId" TEXT,
  "status" "InterviewSessionStatus" NOT NULL DEFAULT 'DRAFT',
  "mode" "InterviewMode" NOT NULL DEFAULT 'AUDIO',
  "promptLens" TEXT,
  "recordingAssetId" TEXT,
  "transcriptionJobId" TEXT,
  "extractionJobId" TEXT,
  "errorMessage" TEXT,
  "recordedAt" TIMESTAMP(3),
  "uploadedAt" TIMESTAMP(3),
  "transcribedAt" TIMESTAMP(3),
  "extractedAt" TIMESTAMP(3),
  "publishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "interview_sessions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "interview_sessions_vendorBoostRequestId_key" ON "interview_sessions"("vendorBoostRequestId");
CREATE UNIQUE INDEX IF NOT EXISTS "interview_sessions_recordingAssetId_key" ON "interview_sessions"("recordingAssetId");
CREATE INDEX IF NOT EXISTS "interview_sessions_createdByUserId_idx" ON "interview_sessions"("createdByUserId");
CREATE INDEX IF NOT EXISTS "interview_sessions_projectId_idx" ON "interview_sessions"("projectId");
CREATE INDEX IF NOT EXISTS "interview_sessions_productId_idx" ON "interview_sessions"("productId");
CREATE INDEX IF NOT EXISTS "interview_sessions_vendorId_idx" ON "interview_sessions"("vendorId");
CREATE INDEX IF NOT EXISTS "interview_sessions_status_idx" ON "interview_sessions"("status");
CREATE INDEX IF NOT EXISTS "interview_sessions_vendorBoostRequestId_idx" ON "interview_sessions"("vendorBoostRequestId");

CREATE TABLE IF NOT EXISTS "interview_questions" (
  "id" TEXT NOT NULL,
  "interviewSessionId" TEXT NOT NULL,
  "order" INTEGER NOT NULL,
  "questionText" TEXT NOT NULL,
  "askedBy" TEXT NOT NULL DEFAULT 'system',
  "timeStartMs" INTEGER,
  "timeEndMs" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "interview_questions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "interview_questions_interviewSessionId_order_idx" ON "interview_questions"("interviewSessionId", "order");

CREATE TABLE IF NOT EXISTS "transcript_segments" (
  "id" TEXT NOT NULL,
  "interviewSessionId" TEXT NOT NULL,
  "order" INTEGER NOT NULL,
  "speaker" TEXT NOT NULL DEFAULT 'designer',
  "startMs" INTEGER NOT NULL,
  "endMs" INTEGER NOT NULL,
  "text" TEXT NOT NULL,
  "confidence" DOUBLE PRECISION,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "transcript_segments_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "transcript_segments_interviewSessionId_order_idx" ON "transcript_segments"("interviewSessionId", "order");
CREATE INDEX IF NOT EXISTS "transcript_segments_interviewSessionId_startMs_endMs_idx" ON "transcript_segments"("interviewSessionId", "startMs", "endMs");

CREATE TABLE IF NOT EXISTS "quote_highlights" (
  "id" TEXT NOT NULL,
  "interviewSessionId" TEXT NOT NULL,
  "startMs" INTEGER NOT NULL,
  "endMs" INTEGER NOT NULL,
  "quoteText" TEXT NOT NULL,
  "useCase" "QuoteUseCase" NOT NULL,
  "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "approvedByDesigner" BOOLEAN NOT NULL DEFAULT false,
  "approvedAt" TIMESTAMP(3),
  "productId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "quote_highlights_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "quote_highlights_interviewSessionId_idx" ON "quote_highlights"("interviewSessionId");
CREATE INDEX IF NOT EXISTS "quote_highlights_useCase_idx" ON "quote_highlights"("useCase");
CREATE INDEX IF NOT EXISTS "quote_highlights_productId_idx" ON "quote_highlights"("productId");
CREATE INDEX IF NOT EXISTS "quote_highlights_approvedByDesigner_idx" ON "quote_highlights"("approvedByDesigner");

CREATE TABLE IF NOT EXISTS "vendor_boost_requests" (
  "id" TEXT NOT NULL,
  "vendorId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "requestedDesignerId" TEXT NOT NULL,
  "status" "VendorBoostRequestStatus" NOT NULL DEFAULT 'PENDING',
  "message" TEXT,
  "expiresAt" TIMESTAMP(3),
  "interviewSessionId" TEXT,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "acceptedAt" TIMESTAMP(3),
  "declinedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "vendor_boost_requests_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "vendor_boost_requests_interviewSessionId_key" ON "vendor_boost_requests"("interviewSessionId");
CREATE INDEX IF NOT EXISTS "vendor_boost_requests_vendorId_idx" ON "vendor_boost_requests"("vendorId");
CREATE INDEX IF NOT EXISTS "vendor_boost_requests_productId_idx" ON "vendor_boost_requests"("productId");
CREATE INDEX IF NOT EXISTS "vendor_boost_requests_projectId_idx" ON "vendor_boost_requests"("projectId");
CREATE INDEX IF NOT EXISTS "vendor_boost_requests_requestedDesignerId_idx" ON "vendor_boost_requests"("requestedDesignerId");
CREATE INDEX IF NOT EXISTS "vendor_boost_requests_status_idx" ON "vendor_boost_requests"("status");
CREATE INDEX IF NOT EXISTS "vendor_boost_requests_expiresAt_idx" ON "vendor_boost_requests"("expiresAt");

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'interview_sessions_recordingAssetId_fkey') THEN
        ALTER TABLE "interview_sessions" ADD CONSTRAINT "interview_sessions_recordingAssetId_fkey" FOREIGN KEY ("recordingAssetId") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'interview_sessions_createdByUserId_fkey') THEN
        ALTER TABLE "interview_sessions" ADD CONSTRAINT "interview_sessions_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'interview_sessions_projectId_fkey') THEN
        ALTER TABLE "interview_sessions" ADD CONSTRAINT "interview_sessions_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'interview_sessions_productId_fkey') THEN
        ALTER TABLE "interview_sessions" ADD CONSTRAINT "interview_sessions_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'interview_sessions_vendorId_fkey') THEN
        ALTER TABLE "interview_sessions" ADD CONSTRAINT "interview_sessions_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'interview_sessions_vendorBoostRequestId_fkey') THEN
        ALTER TABLE "interview_sessions" ADD CONSTRAINT "interview_sessions_vendorBoostRequestId_fkey" FOREIGN KEY ("vendorBoostRequestId") REFERENCES "vendor_boost_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'interview_questions_interviewSessionId_fkey') THEN
        ALTER TABLE "interview_questions" ADD CONSTRAINT "interview_questions_interviewSessionId_fkey" FOREIGN KEY ("interviewSessionId") REFERENCES "interview_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'transcript_segments_interviewSessionId_fkey') THEN
        ALTER TABLE "transcript_segments" ADD CONSTRAINT "transcript_segments_interviewSessionId_fkey" FOREIGN KEY ("interviewSessionId") REFERENCES "interview_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quote_highlights_interviewSessionId_fkey') THEN
        ALTER TABLE "quote_highlights" ADD CONSTRAINT "quote_highlights_interviewSessionId_fkey" FOREIGN KEY ("interviewSessionId") REFERENCES "interview_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quote_highlights_productId_fkey') THEN
        ALTER TABLE "quote_highlights" ADD CONSTRAINT "quote_highlights_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vendor_boost_requests_vendorId_fkey') THEN
        ALTER TABLE "vendor_boost_requests" ADD CONSTRAINT "vendor_boost_requests_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vendor_boost_requests_productId_fkey') THEN
        ALTER TABLE "vendor_boost_requests" ADD CONSTRAINT "vendor_boost_requests_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vendor_boost_requests_projectId_fkey') THEN
        ALTER TABLE "vendor_boost_requests" ADD CONSTRAINT "vendor_boost_requests_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vendor_boost_requests_requestedDesignerId_fkey') THEN
        ALTER TABLE "vendor_boost_requests" ADD CONSTRAINT "vendor_boost_requests_requestedDesignerId_fkey" FOREIGN KEY ("requestedDesignerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vendor_boost_requests_interviewSessionId_fkey') THEN
        ALTER TABLE "vendor_boost_requests" ADD CONSTRAINT "vendor_boost_requests_interviewSessionId_fkey" FOREIGN KEY ("interviewSessionId") REFERENCES "interview_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
