import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(req: NextRequest) {
  try {
    // Check authentication and admin role
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
    }

    const body = await req.json();
    const { title, description, location, startDate, endDate, isPublic = true, type = 'festival' } = body;
    
    if (!title || !description || !location || !startDate || !endDate) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Validate date range
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (start >= end) {
      return NextResponse.json({ error: 'End date must be after start date' }, { status: 400 });
    }

    console.log(`Admin ${(session.user as any).id} creating festival: ${title}`);

    const event = await prisma.event.create({
      data: {
        title,
        description,
        location,
        startDate: start,
        endDate: end,
        isFestival: true, // Admin-created events are festivals
        isApproved: true, // Admin-created events are auto-approved
        requiresApproval: false, // Admin events don't need approval
        createdById: (session.user as any).id,
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
    });

    console.log(`Festival ${event.id} created successfully`);

    return NextResponse.json({ 
      event, 
      message: 'Festival created successfully' 
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating admin festival:', error);
    return NextResponse.json({ error: 'Failed to create festival' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    // Check authentication and admin role
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
    }

    console.log(`Admin ${(session.user as any).id} fetching all events`);

    const events = await prisma.event.findMany({
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
        subevents: {
          include: {
            createdBy: {
              select: {
                id: true,
                name: true,
                companyName: true,
              },
            },
          },
        },
      },
    });

    console.log(`Found ${events.length} events`);

    return NextResponse.json(events);
  } catch (error) {
    console.error('Error fetching events:', error);
    return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 });
  }
} 