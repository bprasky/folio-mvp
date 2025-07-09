import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(req: NextRequest) {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get festivals that are:
    // - type === 'festival' 
    // - startDate >= today (or ending within next 7 days)
    // - isPublic === true
    const activeFestivals = await prisma.event.findMany({
      where: {
        type: 'festival',
        isPublic: true,
        OR: [
          {
            startDate: {
              gte: today,
            },
          },
          {
            endDate: {
              gte: today,
              lte: new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
            },
          },
        ],
      },
      select: {
        id: true,
        title: true,
        startDate: true,
        endDate: true,
      },
      orderBy: {
        startDate: 'asc',
      },
    });

    return NextResponse.json(activeFestivals);
  } catch (error) {
    console.error('Error fetching active festivals:', error);
    return NextResponse.json(
      { error: 'Failed to fetch active festivals' },
      { status: 500 }
    );
  }
} 