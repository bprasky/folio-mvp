export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { assertProjectWrite } from '@/lib/authz/access';
import { makeSlug } from '@/lib/posting/slug';

/**
 * POST /api/interview/realtime/convert
 * Convert completed realtime session to editorial interview format
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { sessionId } = await req.json();

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID required' },
        { status: 400 }
      );
    }

    // Get session with segments
    const realtimeSession = await prisma.realtimeInterviewSession.findUnique({
      where: { id: sessionId },
      include: {
        segments: { orderBy: { sequenceNumber: 'asc' } },
        project: {
          select: {
            id: true,
            title: true,
            designerId: true,
            ownerId: true,
          },
        },
      },
    });

    if (!realtimeSession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Check project write access (owner, designer, org member, or admin)
    try {
      await assertProjectWrite(session.user.id, realtimeSession.projectId);
    } catch {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Check session is completed
    if (realtimeSession.status !== 'COMPLETED') {
      return NextResponse.json(
        { error: 'Session not completed', status: realtimeSession.status },
        { status: 400 }
      );
    }

    // Convert segments to interview answers format
    const designerSegments = realtimeSession.segments.filter(
      (s) => s.role === 'designer'
    );

    const answers = designerSegments.map((segment, index) => {
      // Find the preceding AI segment (the question)
      const precedingAiSegment = realtimeSession.segments.find(
        (s) => s.sequenceNumber === segment.sequenceNumber - 1 && s.role === 'ai'
      );

      return {
        questionId: `realtime-${index}`,
        questionText: precedingAiSegment?.content || 'Opening response',
        answerText: segment.content,
        inputModality: 'voice',
        linkedRoomName: segment.linkedRoomName,
        extractedQuote: segment.extractedQuote,
        extractedProducts: segment.extractedProducts,
        extractedMood: segment.extractedMood,
      };
    });

    // Upsert EditorialInterview
    const editorialInterview = await prisma.editorialInterview.upsert({
      where: { projectId: realtimeSession.projectId },
      create: {
        projectId: realtimeSession.projectId,
        status: 'COMPLETED',
        selectedQuestionIds: answers.map((a) => a.questionId),
      },
      update: {
        status: 'COMPLETED',
        selectedQuestionIds: answers.map((a) => a.questionId),
      },
    });

    // Delete existing answers if any (for clean replacement)
    await prisma.editorialInterviewAnswer.deleteMany({
      where: {
        interviewId: editorialInterview.id,
        questionSource: 'realtime_interview',
      },
    });

    // Create new answers
    await prisma.editorialInterviewAnswer.createMany({
      data: answers.map((a) => ({
        interviewId: editorialInterview.id,
        questionId: a.questionId,
        answerText: a.answerText,
        inputModality: 'voice',
        questionSource: 'realtime_interview',
      })),
    });

    // Build provenance data
    const extractedQuotes = realtimeSession.extractedQuotes as string[] | null;
    const extractedThemes = realtimeSession.extractedThemes as string[] | null;
    const extractedProducts = realtimeSession.extractedProducts as Array<{
      name: string;
      context: string;
    }> | null;

    const provenancePayload = {
      realtimeSessionId: sessionId,
      interview: {
        source: 'realtime',
        payload: {
          answers,
          extractedQuotes: extractedQuotes || [],
          extractedThemes: extractedThemes || [],
          extractedProducts: extractedProducts || [],
          conversationSummary: realtimeSession.conversationSummary,
          turnCount: realtimeSession.turnCount,
          totalDurationMs: realtimeSession.totalDurationMs,
        },
      },
    };

    // Generate slug for post
    const projectSlug = makeSlug(realtimeSession.project.title || 'project');

    // Upsert ProjectPost with provenance
    await prisma.projectPost.upsert({
      where: { projectId: realtimeSession.projectId },
      create: {
        projectId: realtimeSession.projectId,
        slug: `${projectSlug}-${realtimeSession.projectId.slice(0, 8)}`,
        status: 'DRAFT',
        provenance: provenancePayload,
      },
      update: {
        provenance: provenancePayload,
      },
    });

    // Link session to editorial interview
    await prisma.realtimeInterviewSession.update({
      where: { id: sessionId },
      data: { editorialInterviewId: editorialInterview.id },
    });

    return NextResponse.json({
      ok: true,
      editorialInterviewId: editorialInterview.id,
      answerCount: answers.length,
      quoteCount: extractedQuotes?.length || 0,
      themeCount: extractedThemes?.length || 0,
    });
  } catch (error) {
    console.error('Failed to convert session:', error);
    return NextResponse.json(
      { error: 'Failed to convert session' },
      { status: 500 }
    );
  }
}
