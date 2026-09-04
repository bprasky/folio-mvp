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

    // Replace this session's answers.
    //
    // The delete used to be scoped to questionSource = 'realtime_interview'
    // alone, which misses rows holding the very ids about to be written. The
    // path is concrete, not hypothetical: the `answers` built above are also
    // written to provenance below, carrying no questionSource, and
    // rebuildAnswerProjection defaults a source-less answer to 'base_question'.
    // So after any sync, `realtime-0` exists under 'base_question', this delete
    // skips it, and the insert below duplicates it — which is a second row for
    // one row key today and a P2002 once
    // 20260904193000_add_row_key_unique is applied.
    //
    // Widened delete rather than upsert, because that is what this route
    // actually does: it replaces the whole realtime answer set. The two arms
    // are both needed and neither subsumes the other — the questionSource arm
    // retires ids a SHORTER re-run no longer produces (realtime-4, realtime-5
    // after a re-record), and the questionId arm clears anything squatting on
    // an id under a different source.
    //
    // Note the row key (interviewId, questionId, isFollowUp) does not include
    // questionSource, so two sources CANNOT hold different answers for one
    // questionId. That is the constraint's decision, and this route now agrees
    // with it instead of quietly depending on the opposite.
    //
    // Transactional: the delete is destructive, and a failure between the two
    // statements would leave the interview with its answers removed and none
    // written back.
    const realtimeQuestionIds = answers.map((a) => a.questionId);
    await prisma.$transaction([
      prisma.editorialInterviewAnswer.deleteMany({
        where: {
          interviewId: editorialInterview.id,
          OR: [
            { questionSource: 'realtime_interview' },
            { questionId: { in: realtimeQuestionIds } },
          ],
        },
      }),
      prisma.editorialInterviewAnswer.createMany({
        data: answers.map((a) => ({
          interviewId: editorialInterview.id,
          questionId: a.questionId,
          answerText: a.answerText,
          inputModality: 'voice',
          questionSource: 'realtime_interview',
        })),
      }),
    ]);

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
