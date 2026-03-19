export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { getUserOrgMemberships, isOrgAdmin } from '@/lib/permissions';

/**
 * POST /api/orgs/[orgId]/bio-interview/coverage
 *
 * Saves question coverage results from bio import analysis.
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
    const memberships = await getUserOrgMemberships(session.user.id);
    if (!isOrgAdmin(memberships, orgId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { coverage } = await request.json();

    if (!Array.isArray(coverage)) {
      return NextResponse.json({ error: 'coverage must be an array' }, { status: 400 });
    }

    // Find the interview record
    const interview = await prisma.orgBioInterview.findUnique({
      where: { organizationId: orgId },
      select: { id: true },
    });

    if (!interview) {
      return NextResponse.json({ error: 'Interview not found' }, { status: 404 });
    }

    // Upsert coverage records
    for (const item of coverage) {
      await prisma.interviewQuestionCoverage.upsert({
        where: {
          orgBioInterviewId_questionId: {
            orgBioInterviewId: interview.id,
            questionId: item.questionId,
          },
        },
        create: {
          orgBioInterviewId: interview.id,
          questionId: item.questionId,
          depth: item.depth?.toUpperCase() || 'NONE',
          extractedAnswer: item.extractedAnswer || null,
          gapNote: item.gapNote || null,
          askedInFollowUp: item.depth !== 'full',
        },
        update: {
          depth: item.depth?.toUpperCase() || 'NONE',
          extractedAnswer: item.extractedAnswer || null,
          gapNote: item.gapNote || null,
          askedInFollowUp: item.depth !== 'full',
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[POST /api/orgs/[orgId]/bio-interview/coverage] Error:', error);
    return NextResponse.json({ error: 'Failed to save coverage' }, { status: 500 });
  }
}
