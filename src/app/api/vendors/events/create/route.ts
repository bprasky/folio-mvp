import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../auth/[...nextauth]/options';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(req: NextRequest) {
  try {
    // Check authentication and vendor role
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'vendor') {
      return NextResponse.json({ error: 'Forbidden - Vendor access required' }, { status: 403 });
    }

    const body = await req.json();
    const { title, description, location, startDate, endDate, parentFestivalId } = body;
    
    if (!title || !description || !location || !startDate || !endDate || !parentFestivalId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Validate date range
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (start >= end) {
      return NextResponse.json({ error: 'End date must be after start date' }, { status: 400 });
    }

    // Validate that the parent festival exists and is active
    const parentFestival = await prisma.event.findFirst({
      where: {
        id: parentFestivalId,
        type: 'festival',
        isApproved: true,
        startDate: { lte: end },
        endDate: { gte: start },
      },
    });

    if (!parentFestival) {
      return NextResponse.json({ 
        error: 'Invalid festival selection or event dates outside festival period' 
      }, { status: 400 });
    }

    // Validate that the event dates are within the festival period
    if (start < parentFestival.startDate || end > parentFestival.endDate) {
      return NextResponse.json({ 
        error: 'Event dates must be within the festival period' 
      }, { status: 400 });
    }

    const event = await prisma.event.create({
      data: {
        title,
        description,
        location,
        startDate: start,
        endDate: end,
        type: 'event',
        isPublic: true,
        isApproved: null, // Pending approval
        requiresApproval: true,
        parentFestivalId,
        createdById: session.user.id,
      },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
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

    return NextResponse.json({ 
      event, 
      message: 'Event submitted for approval successfully' 
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating vendor event:', error);
    return NextResponse.json({ error: 'Failed to create event' }, { status: 500 });
  }
} 