export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/prompted-content/answers
 *
 * Submit an answer to a prompted question.
 * Creates a PromptedAnswer, updates question status, and enriches bio (ProfileQA).
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as { id: string }).id;
    const body = await req.json();
    const { questionId, answerText, consentToQuote } = body;

    if (!questionId || !answerText?.trim()) {
      return NextResponse.json(
        { error: 'questionId and answerText are required' },
        { status: 400 }
      );
    }

    // Verify question belongs to this user and is answerable
    const question = await prisma.promptedQuestion.findFirst({
      where: {
        id: questionId,
        targetUserId: userId,
        status: { in: ['GENERATED', 'DELIVERED'] },
      },
    });

    if (!question) {
      return NextResponse.json(
        { error: 'Question not found or already answered' },
        { status: 404 }
      );
    }

    // Create the answer
    const answer = await prisma.promptedAnswer.create({
      data: {
        questionId,
        userId,
        answerText: answerText.trim(),
        consentToQuote: consentToQuote ?? true,
      },
    });

    // Update question status
    await prisma.promptedQuestion.update({
      where: { id: questionId },
      data: { status: 'ANSWERED' },
    });

    // Bio enrichment — create a ProfileQA entry
    const profileQA = await prisma.profileQA.create({
      data: {
        userId,
        question: question.questionText,
        answer: answerText.trim(),
        category: 'conviction',
        source: 'prompted_content',
        triggerType: 'prompted_question',
        triggerEntityId: questionId,
        status: 'answered',
        answeredAt: new Date(),
      },
    });

    // Link the ProfileQA back to the answer
    await prisma.promptedAnswer.update({
      where: { id: answer.id },
      data: {
        profileQAId: profileQA.id,
        bioEnriched: true,
      },
    });

    return NextResponse.json({
      answer: {
        id: answer.id,
        answerText: answer.answerText,
        createdAt: answer.createdAt,
      },
      profileQAId: profileQA.id,
      bioEnriched: true,
    });
  } catch (error: any) {
    console.error('[POST /api/prompted-content/answers] Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to submit answer' },
      { status: 500 }
    );
  }
}
