export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/designer/qa/pending
 * Get pending Q&A questions for the designer.
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const qas = await prisma.profileQA.findMany({
      where: { userId: session.user.id, status: 'pending' },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({ qas });
  } catch (error: any) {
    console.error('[GET /api/designer/qa/pending] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
