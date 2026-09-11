import { legacyInterviewBoundary } from '@/lib/spotlight/legacyBoundary';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import { prisma } from "@/lib/prisma";
import { assertProjectView } from "@/lib/authz/access";

/**
 * Verification endpoint to confirm interview answers are stored
 * Useful for confirming data persistence for AI training
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  const spotlightBoundary = await legacyInterviewBoundary(request);
  if (spotlightBoundary) return spotlightBoundary;

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const projectId = params.projectId;
    await assertProjectView(session.user.id, projectId);

    const post = await prisma.projectPost.findUnique({
      where: { projectId },
      select: {
        id: true,
        status: true,
        provenance: true,
        expandedBlocks: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!post) {
      return NextResponse.json({
        exists: false,
        message: "No post found for this project",
      });
    }

    const provenance = (post.provenance as any) || {};
    const interview = provenance.interview || {};
    const payload = interview.payload || {};

    const answers = payload.answers || interview.answers || [];
    const followups = payload.followups || interview.followUps || [];
    const selectedQuestionIds = payload.selectedQuestionIds || interview.selectedQuestionIds || [];

    // Count non-empty answers
    const nonEmptyAnswers = answers.filter((a: any) => a?.answer?.trim());
    const nonEmptyFollowups = followups.filter((f: any) => f?.answer?.trim());

    return NextResponse.json({
      exists: true,
      postId: post.id,
      status: post.status,
      hasExpandedBlocks: !!post.expandedBlocks,
      interview: {
        answerCount: answers.length,
        nonEmptyAnswerCount: nonEmptyAnswers.length,
        followupCount: followups.length,
        nonEmptyFollowupCount: nonEmptyFollowups.length,
        selectedQuestionIdsCount: selectedQuestionIds.length,
        generatedAt: interview.generatedAt,
        generatedWith: interview.generatedWith,
        lastGenerated: interview.status?.endedAt,
      },
      sampleAnswers: nonEmptyAnswers.slice(0, 3).map((a: any) => ({
        questionId: a.questionId,
        answerPreview: a.answer?.substring(0, 100),
        section: a.section,
      })),
      metadata: {
        createdAt: post.createdAt,
        updatedAt: post.updatedAt,
        // Confirmation that answers persist after generation
        answersPersistAfterGeneration: !!post.expandedBlocks && nonEmptyAnswers.length > 0,
      },
    });
  } catch (e: any) {
    console.error('[interview/verify] Error:', e);
    return NextResponse.json(
      { error: 'Failed to verify interview data', details: e?.message },
      { status: 500 }
    );
  }
}


