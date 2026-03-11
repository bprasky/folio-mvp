export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const RequestSchema = z.object({
  orderedIds: z.array(z.string().min(1)),
});

/**
 * PATCH /api/designer/qa/reorder
 * Update display order of Q&As.
 */
export async function PATCH(request: NextRequest) {
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
    const { orderedIds } = parsed.data;

    // Verify all IDs belong to this user
    const userQAs = await prisma.profileQA.findMany({
      where: { userId, id: { in: orderedIds } },
      select: { id: true },
    });

    const userQAIds = new Set(userQAs.map((q) => q.id));
    const invalidIds = orderedIds.filter((id) => !userQAIds.has(id));
    if (invalidIds.length > 0) {
      return NextResponse.json({ error: 'Some Q&A IDs do not belong to you' }, { status: 403 });
    }

    // Update display order in a transaction
    await prisma.$transaction(
      orderedIds.map((id, index) =>
        prisma.profileQA.update({
          where: { id },
          data: { displayOrder: index },
        })
      )
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[PATCH /api/designer/qa/reorder] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
