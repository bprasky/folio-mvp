export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const RequestSchema = z.object({
  questionId: z.string().min(1),
  pinned: z.boolean(),
});

/**
 * POST /api/designer/qa/pin
 * Pin or unpin a Q&A.
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
      where: { id: parsed.data.questionId, userId: session.user.id },
    });

    if (!qa) {
      return NextResponse.json({ error: 'Q&A not found' }, { status: 404 });
    }

    await prisma.profileQA.update({
      where: { id: parsed.data.questionId },
      data: { pinned: parsed.data.pinned },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[POST /api/designer/qa/pin] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
