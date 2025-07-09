import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../auth/[...nextauth]/options';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(req: NextRequest) {
  try {
    // Check authentication and admin role
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
    }

    const { eventId, action, rejectionNotes } = await req.json();

    if (!eventId || !action) {
      return NextResponse.json(
        { error: 'Missing required fields: eventId and action' },
        { status: 400 }
      );
    }

    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be "approve" or "reject"' },
        { status: 400 }
      );
    }

    // Validate that the event exists and requires approval
    const existingEvent = await prisma.event.findUnique({
      where: { id: eventId },
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
          },
        },
      },
    });

    if (!existingEvent) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
    }

    if (!existingEvent.requiresApproval) {
      return NextResponse.json(
        { error: 'This event does not require approval' },
        { status: 400 }
      );
    }

    if (existingEvent.isApproved !== null) {
      return NextResponse.json(
        { error: 'This event has already been processed' },
        { status: 400 }
      );
    }

    // Update the event status
    const updatedEvent = await prisma.event.update({
      where: { id: eventId },
      data: {
        isApproved: action === 'approve',
        rejectionNotes: action === 'reject' ? rejectionNotes : null,
      },
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
          },
        },
      },
    });

    // Optional: Send notification to vendor
    if (action === 'reject' && rejectionNotes) {
      console.log(`Event ${eventId} rejected with notes: ${rejectionNotes}`);
      // TODO: Implement email notification to vendor
    }

    return NextResponse.json({
      success: true,
      event: updatedEvent,
      message: action === 'approve' 
        ? 'Event approved successfully' 
        : 'Event rejected successfully'
    });

  } catch (error) {
    console.error('Error processing event approval:', error);
    return NextResponse.json(
      { error: 'Failed to process event approval' },
      { status: 500 }
    );
  }
} 