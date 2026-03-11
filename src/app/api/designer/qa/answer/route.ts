export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const RequestSchema = z.object({
  questionId: z.string().min(1),
  answer: z.string().min(1).max(2000),
});

/**
 * POST /api/designer/qa/answer
 * Answer a pending Q&A question.
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
    const { questionId, answer } = parsed.data;

    // Verify ownership
    const qa = await prisma.profileQA.findFirst({
      where: { id: questionId, userId },
    });

    if (!qa) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 });
    }

    if (qa.status !== 'pending') {
      return NextResponse.json({ error: 'Question is not pending' }, { status: 400 });
    }

    // Update the Q&A
    const updated = await prisma.profileQA.update({
      where: { id: questionId },
      data: {
        answer,
        status: 'answered',
        answeredAt: new Date(),
      },
    });

    return NextResponse.json({ success: true, qa: updated });
  } catch (error: any) {
    console.error('[POST /api/designer/qa/answer] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
