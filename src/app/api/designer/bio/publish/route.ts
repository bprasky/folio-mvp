export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { generateInitialSeedQuestions } from '@/lib/designer-bio/qa-generation';
import type { InterviewAnswer } from '@/lib/designer-bio/constants';

/**
 * POST /api/designer/bio/publish
 * Publish the bio to the About tab.
 * Also triggers initial Q&A seed generation.
 */
export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    const bio = await prisma.designerBio.findUnique({
      where: { userId },
    });

    if (!bio?.folioBio) {
      return NextResponse.json({ error: 'No bio to publish. Generate one first.' }, { status: 400 });
    }

    // Publish the bio
    await prisma.designerBio.update({
      where: { userId },
      data: { status: 'published' },
    });

    // Trigger initial Q&A seed generation (fire-and-forget)
    const answers = (bio.interviewAnswers as InterviewAnswer[] | null) || [];
    generateInitialSeedQuestions(
      userId,
      bio.folioBio,
      answers.map((a) => ({ question: a.question, answer: a.answer })),
      bio.scrapedData as Record<string, unknown> | null
    ).catch((err) => {
      console.error('[bio/publish] Failed to generate initial Q&A questions:', err);
    });

    return NextResponse.json({ success: true, status: 'published' });
  } catch (error: any) {
    console.error('[POST /api/designer/bio/publish] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
