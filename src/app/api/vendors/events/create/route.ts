import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../auth/[...nextauth]/route';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(req: NextRequest) {
  try {
    // Check authentication and vendor role
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== 'vendor') {
      return NextResponse.json({ error: 'Forbidden - Vendor access required' }, { status: 403 });
    }

    const body = await req.json();
    const { title, description, location, startDate, endDate, parentFestivalId } = body;
    
    // Validate required fields
    if (!title || !description || !location || !startDate || !endDate) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Validate date range
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (start >= end) {
      return NextResponse.json({ error: 'End date must be after start date' }, { status: 400 });
    }

    // Block vendors from creating festivals (only admin can do this)
    if (body.isFestival === true) {
      return NextResponse.json({ error: 'Vendors cannot create festivals' }, { status: 403 });
    }

    console.log(`Vendor ${(session.user as any).id} creating event: ${title}`);

    let eventData: any = {
      title,
      description,
      location,
      startDate: start,
      endDate: end,
      isFestival: false, // Vendors can only create regular events
      createdById: (session.user as any).id,
    };

    // Handle festival sub-event logic
    if (parentFestivalId) {
      // Validate that the parent festival exists and is active
      const parentFestival = await prisma.event.findFirst({
        where: {
          id: parentFestivalId,
          isFestival: true,
          isApproved: true,
        },
      });

      if (!parentFestival) {
        return NextResponse.json({ 
          error: 'Invalid festival selection - Festival not found or not approved' 
        }, { status: 400 });
      }

      // Validate that the event dates are within the festival period
      if (start < parentFestival.startDate || end > parentFestival.endDate) {
        return NextResponse.json({ 
          error: `Event dates must be within the festival period (${parentFestival.startDate.toLocaleDateString()} - ${parentFestival.endDate.toLocaleDateString()})` 
        }, { status: 400 });
      }

      // Set as festival sub-event requiring approval
      eventData.parentFestivalId = parentFestivalId;
      eventData.requiresApproval = true;
      eventData.isApproved = false; // Pending approval
      console.log(`Event submitted to festival ${parentFestival.title} for approval`);
    } else {
      // Standalone event - goes live immediately
      eventData.parentFestivalId = null;
      eventData.requiresApproval = false;
      eventData.isApproved = true; // Approved by default
      console.log(`Standalone event created and live immediately`);
    }

    const event = await prisma.event.create({
      data: eventData,
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            companyName: true,
          },
        },
        parentFestival: parentFestivalId ? {
          select: {
            id: true,
            title: true,
            startDate: true,
            endDate: true,
          },
        } : undefined,
      },
    });

    // Return appropriate message based on event type
    const message = parentFestivalId 
      ? 'Event submitted for approval successfully' 
      : 'Standalone event created successfully';

    console.log(`Event ${event.id} created successfully: ${message}`);

    return NextResponse.json({ 
      event, 
      message 
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating vendor event:', error);
    return NextResponse.json({ error: 'Failed to create event' }, { status: 500 });
  }
} 