import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(req: NextRequest) {
  try {
    // Check authentication (vendors need to see festivals)
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log(`User ${(session.user as any).id} fetching active festivals`);
    
    const now = new Date();
    
    // Fetch active festivals (admin-created events with isFestival: true)
    const festivals = await prisma.event.findMany({
      where: {
        isFestival: true,
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

    console.log(`Found ${festivals.length} active festivals`);

    return NextResponse.json(festivals);
  } catch (error) {
    console.error('Error fetching active festivals:', error);
    return NextResponse.json({ error: 'Failed to fetch festivals' }, { status: 500 });
  }
} 