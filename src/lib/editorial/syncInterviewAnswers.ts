import { prisma } from '@/lib/prisma';

/**
 * Sync answers from ProjectPost provenance to EditorialInterviewAnswer records
 * This bridges the gap between the current ProjectPost system and the new EditorialInterview system
 */
export async function syncAnswersToEditorialInterview(
  projectId: string
): Promise<{ interviewId: string; answersCreated: number }> {
  // Get or create EditorialInterview
  let interview = await prisma.editorialInterview.findUnique({
    where: { projectId },
  });

  if (!interview) {
    interview = await prisma.editorialInterview.create({
      data: {
        projectId,
        status: 'IN_PROGRESS',
        selectedQuestionIds: [],
      },
    });
  }

  // Get answers from ProjectPost provenance
  const post = await prisma.projectPost.findUnique({
    where: { projectId },
    select: { provenance: true },
  });

  if (!post || !post.provenance) {
    return { interviewId: interview.id, answersCreated: 0 };
  }

  const provenance = post.provenance as any;
  const interviewData = provenance.interview || {};
  const payload = interviewData.payload || {};
  const answers = payload.answers || [];
  const followups = payload.followups || [];

  // Delete existing answers to avoid duplicates
  await prisma.editorialInterviewAnswer.deleteMany({
    where: { interviewId: interview.id },
  });

  // Create answer records
  let answersCreated = 0;

  for (const answer of [...answers, ...followups]) {
    await prisma.editorialInterviewAnswer.create({
      data: {
        interviewId: interview.id,
        questionId: answer.questionId || answer.id || 'unknown',
        answerText: answer.answer || '',
        isFollowUp: answer.isFollowUp || false,
        inputModality: 'text',
        // Extract new fields from answer metadata if available
        linkedImageId: answer.linkedImageId || null,
        linkedProductId: answer.linkedProductId || null,
        questionSource: answer.questionSource || (answer.isFollowUp ? 'follow_up' : 'base_question'),
        aiClassificationAttribute: answer.aiClassificationAttribute || null,
      },
    });
    answersCreated++;
  }

  return { interviewId: interview.id, answersCreated };
}

