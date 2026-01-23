export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { generateTeamBlurb } from '@/lib/org-onboarding/generate-team-blurb';

/**
 * POST /api/orgs/[orgId]/team/[orgUserId]/quiz/generate - Generate team member blurb
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { orgId: string; orgUserId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { orgId, orgUserId } = params;

    // Verify the orgUser exists and belongs to this user
    const orgUser = await prisma.organizationUser.findUnique({
      where: { id: orgUserId },
      include: {
        user: {
          select: { name: true }
        },
        teamMemberQuiz: true
      }
    });

    if (!orgUser || orgUser.organizationId !== orgId || orgUser.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (!orgUser.teamMemberQuiz) {
      return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });
    }

    // Get org info for context
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      include: { bioInterview: true }
    });

    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Generate content
    const generated = await generateTeamBlurb({
      orgUserId,
      userName: orgUser.user.name,
      orgName: org.name,
      quiz: {
        joinDate: orgUser.teamMemberQuiz.joinDate || undefined,
        specialties: orgUser.teamMemberQuiz.specialties,
        whatBroughtYou: orgUser.teamMemberQuiz.whatBroughtYou || undefined,
        roleInProcess: orgUser.teamMemberQuiz.roleInProcess || undefined,
        proudestProject: orgUser.teamMemberQuiz.proudestProject || undefined,
        background: orgUser.teamMemberQuiz.background || undefined,
        contextualAnswers: orgUser.teamMemberQuiz.contextualAnswers as Record<string, string> | undefined
      },
      orgPhilosophy: org.bioInterview?.philosophyStatement || undefined
    });

    return NextResponse.json(generated);
  } catch (error) {
    console.error('[POST /api/orgs/[orgId]/team/[orgUserId]/quiz/generate] Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate team blurb' },
      { status: 500 }
    );
  }
}
