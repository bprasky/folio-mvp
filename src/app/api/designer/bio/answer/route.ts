export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import type { InterviewAnswer } from '@/lib/designer-bio/constants';

const RequestSchema = z.object({
  questionId: z.string().min(1),
  question: z.string().min(1),
  answer: z.string().min(1),
  round: z.enum(['base', 'followup']).default('base'),
});

/**
 * POST /api/designer/bio/answer
 * Save an answer to a bio interview question.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request', details: parsed.error.format() }, { status: 400 });
    }

    const userId = session.user.id;
    const { questionId, question, answer, round } = parsed.data;

    // Get or create bio record
    let bio = await prisma.designerBio.findUnique({
      where: { userId },
    });

    if (!bio) {
      bio = await prisma.designerBio.create({
        data: { userId, status: 'interviewing' },
      });
    }

    // Append answer to interviewAnswers JSON
    const existingAnswers = (bio.interviewAnswers as InterviewAnswer[] | null) || [];

    // Replace if same questionId exists, otherwise append
    const existingIndex = existingAnswers.findIndex((a) => a.id === questionId);
    const newAnswer: InterviewAnswer = { id: questionId, question, answer, round };

    if (existingIndex >= 0) {
      existingAnswers[existingIndex] = newAnswer;
    } else {
      existingAnswers.push(newAnswer);
    }

    await prisma.designerBio.update({
      where: { userId },
      data: {
        interviewAnswers: existingAnswers as any,
        status: bio.status === 'empty' || bio.status === 'scraped' ? 'interviewing' : bio.status,
      },
    });

    const baseAnswerCount = existingAnswers.filter((a) => a.round === 'base').length;
    const canGenerateBio = baseAnswerCount >= 3;
    const hasFollowUps = existingAnswers.some((a) => a.round === 'followup');

    return NextResponse.json({
      success: true,
      answerCount: existingAnswers.length,
      baseAnswerCount,
      canGenerateBio,
      hasFollowUps,
    });
  } catch (error: any) {
    console.error('[POST /api/designer/bio/answer] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
