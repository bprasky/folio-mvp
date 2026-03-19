import { prisma } from '@/lib/prisma';

interface InterviewStatus {
  interviewCompleted: boolean;
  extractionCompleted: boolean;
  interviewId: string | null;
  redirectTo: string | null;
}

/**
 * Check whether an org has completed its About interview and extraction.
 * Used to gate access to the profile edit form.
 */
export async function getOrgInterviewStatus(orgId: string): Promise<InterviewStatus> {
  const [org, interview] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: orgId },
      select: {
        interviewProfileExtractedAt: true,
        profileSourcedFromInterview: true,
      },
    }),
    prisma.orgBioInterview.findUnique({
      where: { organizationId: orgId },
      select: {
        id: true,
        generatedAt: true,
        conversationalAnswers: true,
        interviewFormat: true,
      },
    }),
  ]);

  // Interview is complete if it exists and has either generated content (legacy)
  // or conversational answers (new format)
  const interviewCompleted = !!interview && (
    !!interview.generatedAt ||
    (interview.interviewFormat === 'conversational' && !!interview.conversationalAnswers)
  );

  const extractionCompleted = !!org?.interviewProfileExtractedAt;

  return {
    interviewCompleted,
    extractionCompleted,
    interviewId: interview?.id ?? null,
    redirectTo: interviewCompleted ? null : `/org/${orgId}/settings/about-interview`,
  };
}

/**
 * Check whether a user has completed their personal About interview.
 */
export async function getUserInterviewStatus(userId: string): Promise<InterviewStatus> {
  const [user, interview] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        interviewProfileExtractedAt: true,
        profileSourcedFromInterview: true,
      },
    }),
    prisma.profileInterview.findUnique({
      where: { userId },
      select: {
        id: true,
        status: true,
      },
    }),
  ]);

  const interviewCompleted = !!interview && interview.status === 'PUBLISHED';
  const extractionCompleted = !!user?.interviewProfileExtractedAt;

  return {
    interviewCompleted,
    extractionCompleted,
    interviewId: interview?.id ?? null,
    redirectTo: interviewCompleted ? null : `/profile/about-interview`,
  };
}
