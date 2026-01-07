import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const eventId = params.id;

    const event = await prisma.event.update({
      where: { id: eventId },
      data: {
        isApproved: true,
        requiresApproval: false,
        rejectionNotes: null
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
      message: 'Event approved successfully',
      event
    });
  } catch (error) {
    console.error('Error approving event:', error);
    return NextResponse.json(
      { error: 'Failed to approve event' },
      { status: 500 }
    );
  }
} 