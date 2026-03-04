export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/orgs/[orgId]/team/[orgUserId]/quiz - Save team member quiz answers
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
      where: { id: orgUserId }
    });

    if (!orgUser || orgUser.organizationId !== orgId || orgUser.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { answers } = await request.json();

    // Extract contextual answers from nested paths
    const contextualAnswers: Record<string, string> = {};
    const quizAnswers: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(answers)) {
      if (key.startsWith('contextualAnswers.')) {
        const fieldName = key.replace('contextualAnswers.', '');
        contextualAnswers[fieldName] = value as string;
      } else {
        quizAnswers[key] = value;
      }
    }

    // Parse join date
    let joinDate: Date | null = null;
    if (quizAnswers.joinDate) {
      joinDate = new Date(quizAnswers.joinDate as string + '-01');
    }

    // Upsert quiz
    const quiz = await prisma.teamMemberQuiz.upsert({
      where: { orgUserId },
      create: {
        orgUserId,
        joinDate,
        specialties: (quizAnswers.specialties as string[]) || [],
        whatBroughtYou: quizAnswers.whatBroughtYou as string | null,
        roleInProcess: quizAnswers.roleInProcess as string | null,
        proudestProject: quizAnswers.proudestProject as string | null,
        background: quizAnswers.background as string | null,
        contextualAnswers: Object.keys(contextualAnswers).length > 0 ? contextualAnswers : null
      },
      update: {
        joinDate,
        specialties: (quizAnswers.specialties as string[]) || [],
        whatBroughtYou: quizAnswers.whatBroughtYou as string | null,
        roleInProcess: quizAnswers.roleInProcess as string | null,
        proudestProject: quizAnswers.proudestProject as string | null,
        background: quizAnswers.background as string | null,
        contextualAnswers: Object.keys(contextualAnswers).length > 0 ? contextualAnswers : null
      }
    });

    return NextResponse.json({ success: true, quiz });
  } catch (error) {
    console.error('[POST /api/orgs/[orgId]/team/[orgUserId]/quiz] Error:', error);
    return NextResponse.json(
      { error: 'Failed to save quiz' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/orgs/[orgId]/team/[orgUserId]/quiz - Get team member quiz
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { orgId: string; orgUserId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { orgUserId } = params;

    const quiz = await prisma.teamMemberQuiz.findUnique({
      where: { orgUserId }
    });

    return NextResponse.json({ quiz });
  } catch (error) {
    console.error('[GET /api/orgs/[orgId]/team/[orgUserId]/quiz] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch quiz' },
      { status: 500 }
    );
  }
}
