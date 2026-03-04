export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/requireAdmin';

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();

    const [
      totalEvents,
      pendingEvents,
      approvedEvents,
      recentEvents,
    ] = await Promise.all([
      prisma.event.count(),
      prisma.event.count({
        where: {
          isApproved: false,
        },
      }),
      prisma.event.count({
        where: {
          isApproved: true,
        },
      }),
      prisma.event.findMany({
        take: 5,
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          createdBy: {
            select: {
              id: true,
              name: true,
              companyName: true,
            },
          },
        },
      }),
    ]);

    return NextResponse.json({
      totalEvents,
      pendingEvents,
      approvedEvents,
      recentEvents,
    });
  } catch (error: any) {
    if (error.status === 401) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (error.status === 403) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    console.error('Error fetching event stats:', error);
    return NextResponse.json({ error: 'Failed to fetch event stats' }, { status: 500 });
  }
}
