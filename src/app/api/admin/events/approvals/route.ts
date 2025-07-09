import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../auth/[...nextauth]/route';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(req: NextRequest) {
  try {
    // Check authentication and admin role
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
    }

    console.log(`Admin ${(session.user as any).id} fetching events requiring approval`);

    // Fetch events that require approval (vendor-created events)
    const events = await prisma.event.findMany({
      where: {
        requiresApproval: true,
      },
      orderBy: [
        { isApproved: 'asc' }, // Pending first (false values)
        { createdAt: 'desc' },
      ],
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
            companyName: true,
          },
        },
        parentFestival: {
          select: {
            id: true,
            title: true,
            startDate: true,
            endDate: true,
          },
        },
      },
    });

    console.log(`Found ${events.length} events requiring approval`);

    return NextResponse.json(events);
  } catch (error) {
    console.error('Error fetching events for approval:', error);
    return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 });
  }
} 