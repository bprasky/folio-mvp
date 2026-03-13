export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(req.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10)));
    const skip = (page - 1) * limit;

    const userId = session.user.id;

    const [visits, total] = await Promise.all([
      prisma.visitRecord.findMany({
        where: {
          OR: [
            { initiatorUserId: userId },
            { recipientUserId: userId },
          ],
        },
        include: {
          initiatorUser: {
            select: { id: true, name: true, profileImage: true, role: true, title: true },
          },
          recipientUser: {
            select: { id: true, name: true, profileImage: true, role: true, title: true },
          },
          initiatorOrg: { select: { id: true, name: true, type: true, logo: true } },
          recipientOrg: { select: { id: true, name: true, type: true, logo: true } },
          event: { select: { id: true, title: true } },
          _count: { select: { productShares: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.visitRecord.count({
        where: {
          OR: [
            { initiatorUserId: userId },
            { recipientUserId: userId },
          ],
        },
      }),
    ]);

    return NextResponse.json({
      visits,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('[visits/my] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
