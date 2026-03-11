export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { generateInitialSeedQuestions, canGenerateQuestions } from '@/lib/designer-bio/qa-generation';
import type { InterviewAnswer } from '@/lib/designer-bio/constants';

/**
 * POST /api/designer/qa/generate
 * Force-generate new Q&A questions (admin/internal trigger).
 */
export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    if (!(await canGenerateQuestions(userId))) {
      return NextResponse.json(
        { error: 'Cannot generate more questions right now. You may have too many pending or it is too soon.' },
        { status: 429 }
      );
    }

    const bio = await prisma.designerBio.findUnique({
      where: { userId },
    });

    if (!bio?.folioBio) {
      return NextResponse.json({ error: 'Publish your bio first before generating Q&A questions.' }, { status: 400 });
    }

    const answers = (bio.interviewAnswers as InterviewAnswer[] | null) || [];

    await generateInitialSeedQuestions(
      userId,
      bio.folioBio,
      answers.map((a) => ({ question: a.question, answer: a.answer })),
      bio.scrapedData as Record<string, unknown> | null
    );

    // Return the new pending questions
    const pending = await prisma.profileQA.findMany({
      where: { userId, status: 'pending' },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, qas: pending });
  } catch (error: any) {
    console.error('[POST /api/designer/qa/generate] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
