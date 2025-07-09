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

    const { eventId, action, notes } = await req.json();

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

    // Update the event status
    const updatedEvent = await prisma.event.update({
      where: { id: eventId },
      data: {
        isApproved: action === 'approve',
        rejectionNotes: action === 'reject' ? notes : null,
      },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Optional: Send notification to vendor
    if (action === 'reject' && notes) {
      // You could implement email notification here
      console.log(`Event ${eventId} rejected with notes: ${notes}`);
    }

    return NextResponse.json({
      success: true,
      event: updatedEvent,
      message: action === 'approve' 
        ? 'Event approved and now public' 
        : 'Event rejected'
    });

  } catch (error) {
    console.error('Error processing event approval:', error);
    return NextResponse.json(
      { error: 'Failed to process event approval' },
      { status: 500 }
    );
  }
} 