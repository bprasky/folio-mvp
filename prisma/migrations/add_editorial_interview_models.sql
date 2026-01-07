-- CreateEnum
CREATE TYPE "EditorialInterviewStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'PUBLISHED');

-- CreateTable
CREATE TABLE "editorial_interviews" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "status" "EditorialInterviewStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "selected_question_ids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "editorial_interviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "editorial_interview_answers" (
    "id" TEXT NOT NULL,
    "interview_id" TEXT NOT NULL,
    "question_id" TEXT NOT NULL,
    "is_follow_up" BOOLEAN NOT NULL DEFAULT false,
    "parent_answer_id" TEXT,
    "answer_text" TEXT NOT NULL,
    "audio_url" TEXT,
    "input_modality" TEXT NOT NULL DEFAULT 'text',
    "confidence_score" DOUBLE PRECISION,
    "inferred_priorities" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "soft_constraints" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "editorial_interview_answers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "editorial_interviews_project_id_key" ON "editorial_interviews"("project_id");

-- CreateIndex
CREATE INDEX "editorial_interview_answers_interview_id_idx" ON "editorial_interview_answers"("interview_id");

-- CreateIndex
CREATE INDEX "editorial_interview_answers_question_id_idx" ON "editorial_interview_answers"("question_id");

-- AddForeignKey
ALTER TABLE "editorial_interviews" ADD CONSTRAINT "editorial_interviews_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "editorial_interview_answers" ADD CONSTRAINT "editorial_interview_answers_interview_id_fkey" FOREIGN KEY ("interview_id") REFERENCES "editorial_interviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;


