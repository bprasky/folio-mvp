import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(req: NextRequest) {
  try {
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
  } catch (error) {
    console.error('Error fetching event stats:', error);
    return NextResponse.json({ error: 'Failed to fetch event stats' }, { status: 500 });
  }
} 