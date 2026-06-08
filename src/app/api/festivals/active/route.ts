// @idor-allow: public-read reason="Public list of currently-active festivals"
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const now = new Date();
    
    // Fetch active festivals (admin-created events of type 'festival')
    const festivals = await prisma.event.findMany({
      where: {
        type: 'festival',
        isApproved: true,
        endDate: { gte: now }, // Only future or ongoing festivals
      },
      orderBy: {
        startDate: 'asc',
      },
      select: {
        id: true,
        title: true,
        description: true,
        location: true,
        startDate: true,
        endDate: true,
        createdBy: {
          select: {
            id: true,
            name: true,
            companyName: true,
          },
        },
      },
    });

    return NextResponse.json(festivals);
  } catch (error) {
    console.error('Error fetching active festivals:', error);
    return NextResponse.json({ error: 'Failed to fetch festivals' }, { status: 500 });
  }
} 