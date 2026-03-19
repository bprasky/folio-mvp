-- Bio Import: Allow designers to import existing bios before the interview

-- Add bio import fields to org_bio_interview
ALTER TABLE "org_bio_interview" ADD COLUMN "importedBioText" TEXT;
ALTER TABLE "org_bio_interview" ADD COLUMN "importedBioUrl" TEXT;
ALTER TABLE "org_bio_interview" ADD COLUMN "importedBioAnalyzedAt" TIMESTAMP(3);
ALTER TABLE "org_bio_interview" ADD COLUMN "bioImportType" TEXT NOT NULL DEFAULT 'FRESH';

-- Create interview_question_coverage table for tracking bio analysis results
CREATE TABLE "interview_question_coverage" (
    "id" TEXT NOT NULL,
    "orgBioInterviewId" TEXT,
    "questionId" TEXT NOT NULL,
    "depth" TEXT NOT NULL,
    "extractedAnswer" TEXT,
    "gapNote" TEXT,
    "askedInFollowUp" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "interview_question_coverage_pkey" PRIMARY KEY ("id")
);

-- Create unique index for one coverage record per question per interview
CREATE UNIQUE INDEX "interview_question_coverage_orgBioInterviewId_questionId_key"
    ON "interview_question_coverage"("orgBioInterviewId", "questionId");

-- Add foreign key
ALTER TABLE "interview_question_coverage"
    ADD CONSTRAINT "interview_question_coverage_orgBioInterviewId_fkey"
    FOREIGN KEY ("orgBioInterviewId") REFERENCES "org_bio_interview"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
