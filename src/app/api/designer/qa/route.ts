export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/designer/qa
 * Get all Q&As for the designer (filtered by status).
 *
 * Query params:
 * - status: comma-separated statuses (default: 'answered')
 * - includeAll: if 'true', return all statuses
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const includeAll = request.nextUrl.searchParams.get('includeAll') === 'true';
    const statusParam = request.nextUrl.searchParams.get('status');

    const where: any = { userId };

    if (!includeAll) {
      if (statusParam) {
        where.status = { in: statusParam.split(',') };
      } else {
        where.status = 'answered';
      }
    }

    const qas = await prisma.profileQA.findMany({
      where,
      orderBy: [
        { pinned: 'desc' },
        { displayOrder: 'asc' },
        { answeredAt: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    return NextResponse.json({ qas });
  } catch (error: any) {
    console.error('[GET /api/designer/qa] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
