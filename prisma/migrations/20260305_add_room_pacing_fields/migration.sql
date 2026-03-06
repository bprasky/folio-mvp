-- AlterTable: Add room pacing fields to editorial_interview_answers
ALTER TABLE "editorial_interview_answers" ADD COLUMN "room_id" TEXT;
ALTER TABLE "editorial_interview_answers" ADD COLUMN "is_cross_room" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex: room_id index for editorial_interview_answers
CREATE INDEX "editorial_interview_answers_room_id_idx" ON "editorial_interview_answers"("room_id");

-- AlterTable: Add room progress tracking to editorial_interviews
ALTER TABLE "editorial_interviews" ADD COLUMN "room_progress" JSONB;
