export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { getUserOrgMemberships, isOrgAdmin } from '@/lib/permissions';
import { generateOrgBio } from '@/lib/org-onboarding/generate-org-bio';
import {
  ORG_ABOUT_QUESTIONS,
  buildTranscriptFromAnswers,
} from '@/lib/org-onboarding/conversational-interview-questions';

/**
 * POST /api/orgs/[orgId]/bio-interview/generate - Generate AI bio from interview
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { orgId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { orgId } = params;

    // Verify user is org owner/admin
    const memberships = await getUserOrgMemberships(session.user.id);
    if (!isOrgAdmin(memberships, orgId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get org and interview data
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      include: { bioInterview: true }
    });

    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    if (!org.bioInterview) {
      return NextResponse.json({ error: 'Interview not found' }, { status: 404 });
    }

    // Generate bio — use transcript for conversational, legacy fields otherwise
    const interview = org.bioInterview;
    let generated;

    if (interview.interviewFormat === 'conversational' && interview.conversationalAnswers) {
      const answers = interview.conversationalAnswers as Record<string, string>;
      const transcript = buildTranscriptFromAnswers(answers, ORG_ABOUT_QUESTIONS);
      generated = await generateOrgBio({
        organizationId: orgId,
        orgName: org.name,
        transcript,
      });
    } else {
      generated = await generateOrgBio({
        organizationId: orgId,
        orgName: org.name,
        interview: {
          originStory: interview.originStory || undefined,
          philosophyStatement: interview.philosophyStatement || undefined,
          projectTypes: interview.projectTypes,
          location: interview.location || undefined,
          serviceRegions: interview.serviceRegions,
          idealClient: interview.idealClient || undefined,
          layer2Responses: interview.layer2Responses as Record<string, string> | undefined,
          recognitionMentions: interview.recognitionMentions || undefined,
          collaboratorMentions: interview.collaboratorMentions || undefined
        }
      });
    }

    // Update onboarding progress
    await prisma.orgOnboardingProgress.upsert({
      where: { organizationId: orgId },
      create: {
        organizationId: orgId,
        bioInterviewComplete: true
      },
      update: {
        bioInterviewComplete: true
      }
    });

    return NextResponse.json(generated);
  } catch (error) {
    console.error('[POST /api/orgs/[orgId]/bio-interview/generate] Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate bio' },
      { status: 500 }
    );
  }
}
