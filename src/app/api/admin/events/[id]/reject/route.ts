import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const eventId = params.id;
    const body = await request.json();
    const { reason } = body;

    const event = await prisma.event.update({
      where: { id: eventId },
      data: {
        isApproved: false,
        requiresApproval: false,
        rejectionNotes: reason || 'Rejected by admin'
      },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    return NextResponse.json({
      message: 'Event rejected successfully',
      event
    });
  } catch (error) {
    console.error('Error rejecting event:', error);
    return NextResponse.json(
      { error: 'Failed to reject event' },
      { status: 500 }
    );
  }
} 