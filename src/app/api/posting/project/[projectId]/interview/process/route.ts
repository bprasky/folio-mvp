import { legacyInterviewBoundary } from '@/lib/spotlight/legacyBoundary';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { processInterviewAnswers } from '@/lib/editorial/processInterviewAnswers';
import { syncAnswersToEditorialInterview } from '@/lib/editorial/syncInterviewAnswers';
import { prisma } from '@/lib/prisma';
import { assertProjectWrite } from '@/lib/authz/access';

export async function POST(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  const spotlightBoundary = await legacyInterviewBoundary(request);
  if (spotlightBoundary) return spotlightBoundary;

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const projectId = params.projectId;
    await assertProjectWrite(session.user.id, projectId);

    // Find the interview for this project, or sync from ProjectPost
    let interview = await prisma.editorialInterview.findUnique({
      where: { projectId },
    });

    if (!interview) {
      // Sync from ProjectPost if EditorialInterview doesn't exist
      const syncResult = await syncAnswersToEditorialInterview(projectId);
      interview = await prisma.editorialInterview.findUnique({
        where: { id: syncResult.interviewId },
      });
      
      if (!interview) {
        return NextResponse.json(
          { error: 'Interview not found and could not be created' },
          { status: 404 }
        );
      }
    }

    // Process answers into decisions and verifications
    const result = await processInterviewAnswers(interview.id);

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('Error processing interview:', error);
    return NextResponse.json(
      { error: 'Failed to process interview' },
      { status: 500 }
    );
  }
}

