import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../auth/[...nextauth]/options';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(req: NextRequest) {
  try {
    // Check authentication and admin role
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const filter = searchParams.get('filter') || 'pending';

    // Build where clause based on filter
    const whereClause: any = {
      requiresApproval: true,
    };

    if (filter === 'pending') {
      whereClause.isApproved = null; // Events that haven't been approved/rejected yet
    }

    const events = await prisma.event.findMany({
      where: whereClause,
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            companyName: true,
          },
        },
      },
      orderBy: [
        {
          startDate: 'asc',
        },
        {
          createdAt: 'desc',
        },
      ],
    });

    // Fetch parent festival data for events that have parentFestivalId
    const eventsWithFestivals = await Promise.all(
      events.map(async (event) => {
        if (event.parentFestivalId) {
          const parentFestival = await prisma.event.findUnique({
            where: { 
              id: event.parentFestivalId,
              type: 'festival'
            },
            select: {
              id: true,
              title: true,
              startDate: true,
            }
          });
          return { ...event, parentFestival };
        }
        return event;
      })
    );

    return NextResponse.json(eventsWithFestivals);
  } catch (error) {
    console.error('Error fetching events for approval:', error);
    return NextResponse.json(
      { error: 'Failed to fetch events for approval' },
      { status: 500 }
    );
  }
} 