export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const RequestSchema = z.object({
  questionId: z.string().min(1),
});

/**
 * POST /api/designer/qa/hide
 * Hide a previously answered Q&A from public display.
 * Data is kept internally for Atelier/editorial use.
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
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    const qa = await prisma.profileQA.findFirst({
      where: { id: parsed.data.questionId, userId: session.user.id, status: 'answered' },
    });

    if (!qa) {
      return NextResponse.json({ error: 'Answered Q&A not found' }, { status: 404 });
    }

    await prisma.profileQA.update({
      where: { id: parsed.data.questionId },
      data: { status: 'hidden' },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[POST /api/designer/qa/hide] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
