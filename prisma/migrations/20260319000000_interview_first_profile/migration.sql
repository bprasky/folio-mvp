-- Interview-first profile system: eliminates dual-path problem
-- where designers must both complete interview AND manually fill profile fields

-- Add interview-first fields to users
ALTER TABLE "users" ADD COLUMN "interviewProfileExtractedAt" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "profileSourcedFromInterview" BOOLEAN NOT NULL DEFAULT false;

-- Add interview-first fields to organizations
ALTER TABLE "organizations" ADD COLUMN "interviewProfileExtractedAt" TIMESTAMP(3);
ALTER TABLE "organizations" ADD COLUMN "profileSourcedFromInterview" BOOLEAN NOT NULL DEFAULT false;

-- Add conversational interview support to org_bio_interview
ALTER TABLE "org_bio_interview" ADD COLUMN "conversationalAnswers" JSONB;
ALTER TABLE "org_bio_interview" ADD COLUMN "interviewFormat" TEXT NOT NULL DEFAULT 'layered';

-- Create ProfileFieldSourceType enum
CREATE TYPE "ProfileFieldSourceType" AS ENUM ('INTERVIEW_EXTRACTED', 'MANUALLY_ENTERED', 'INTERVIEW_THEN_EDITED');

-- Create profile_field_sources table
CREATE TABLE "profile_field_sources" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "organizationId" TEXT,
    "fieldName" TEXT NOT NULL,
    "source" "ProfileFieldSourceType" NOT NULL,
    "interviewSessionId" TEXT,
    "extractedAt" TIMESTAMP(3),
    "manuallyEditedAt" TIMESTAMP(3),

    CONSTRAINT "profile_field_sources_pkey" PRIMARY KEY ("id")
);

-- Create unique indexes for field-level sourcing
CREATE UNIQUE INDEX "profile_field_sources_userId_fieldName_key" ON "profile_field_sources"("userId", "fieldName");
CREATE UNIQUE INDEX "profile_field_sources_organizationId_fieldName_key" ON "profile_field_sources"("organizationId", "fieldName");

-- Add foreign keys
ALTER TABLE "profile_field_sources" ADD CONSTRAINT "profile_field_sources_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "profile_field_sources" ADD CONSTRAINT "profile_field_sources_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
