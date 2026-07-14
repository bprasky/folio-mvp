import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';

// GET /api/editorial-queue
//
// The current designer's live queue: recommended and in-progress pieces, each
// with its angle framing and the generated prompts. Backs the queue surface
// (the dropdown badge + /designer/queue page).
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const items = await prisma.editorialQueueItem.findMany({
    where: {
      designerId: session.user.id,
      status: { in: ['recommended', 'in_progress'] },
    },
    select: {
      id: true,
      format: true,
      status: true,
      prompts: true,
      createdAt: true,
      angle: {
        select: { angleType: true, summary: true, confidence: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ count: items.length, items }, { status: 200 });
}
