import { legacyInterviewBoundary } from '@/lib/spotlight/legacyBoundary';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { processInterviewAnswers } from '@/lib/editorial/processInterviewAnswers';
import { syncAnswersToEditorialInterview } from '@/lib/editorial/syncInterviewAnswers';
import { prisma } from '@/lib/prisma';
import { assertProjectWrite } from '@/lib/authz/access';
import { EditorialInterviewStatus } from '@prisma/client';

export async function PATCH(
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
    const post = await prisma.projectPost.findUnique({ where: { projectId }, select: { provenance: true } });
    if ((post?.provenance as any)?.interview?.guided) {
      return NextResponse.json({ error: 'GUIDED_INTERVIEW_REQUIRED', message: 'Finish or resume this interview in the guided workspace.' }, { status: 409 });
    }

    const { status } = await request.json();

    if (!status || !['IN_PROGRESS', 'COMPLETED', 'PUBLISHED'].includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status. Must be IN_PROGRESS, COMPLETED, or PUBLISHED' },
        { status: 400 }
      );
    }

    // Find or create interview
    let interview = await prisma.editorialInterview.findUnique({
      where: { projectId },
    });

    if (!interview) {
      // Sync from ProjectPost if EditorialInterview doesn't exist
      await syncAnswersToEditorialInterview(projectId);
      interview = await prisma.editorialInterview.findUnique({
        where: { projectId },
      });
      
      if (!interview) {
        return NextResponse.json(
          { error: 'Interview not found and could not be created' },
          { status: 404 }
        );
      }
    }

    // Update status
    const updatedInterview = await prisma.editorialInterview.update({
      where: { id: interview.id },
      data: { status: status as EditorialInterviewStatus },
    });

    // If status is COMPLETED, process answers into decisions and verifications
    if (status === 'COMPLETED') {
      try {
        const { processInterviewAnswers } = await import('@/lib/editorial/processInterviewAnswers');
        await processInterviewAnswers(interview.id);
      } catch (error) {
        console.error('Error processing interview answers:', error);
        // Don't fail the status update, just log the error
      }
    }

    return NextResponse.json({
      success: true,
      interview: updatedInterview,
    });
  } catch (error) {
    console.error('Error updating interview status:', error);
    return NextResponse.json(
      { error: 'Failed to update interview status' },
      { status: 500 }
    );
  }
}

