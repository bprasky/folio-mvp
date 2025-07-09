import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const data = await request.json();
    
    // Validate required fields
    if (!data.userId || !data.status) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: userId, status' },
        { status: 400 }
      );
    }

    // Check if event exists
    const event = await prisma.event.findUnique({
      where: { id: params.id }
    });

    if (!event) {
      return NextResponse.json(
        { success: false, error: 'Event not found' },
        { status: 404 }
      );
    }

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: data.userId }
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    // Create or update RSVP
    const rsvp = await prisma.eventRSVP.upsert({
      where: {
        eventId_userId: {
          eventId: params.id,
          userId: data.userId
        }
      },
      update: {
        status: data.status,
        notes: data.notes
      },
      create: {
        eventId: params.id,
        userId: data.userId,
        status: data.status,
        notes: data.notes
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            profileImage: true
          }
        }
      }
    });

    // Update event RSVP count
    const rsvpCount = await prisma.eventRSVP.count({
      where: { eventId: params.id }
    });

    await prisma.event.update({
      where: { id: params.id },
      data: { rsvps: rsvpCount }
    });

    return NextResponse.json({ 
      success: true, 
      rsvp,
      message: 'RSVP updated successfully' 
    });

  } catch (error) {
    console.error('Error updating RSVP:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update RSVP' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Missing userId parameter' },
        { status: 400 }
      );
    }

    // Check if RSVP exists
    const existingRSVP = await prisma.eventRSVP.findUnique({
      where: {
        eventId_userId: {
          eventId: params.id,
          userId: userId
        }
      }
    });

    if (!existingRSVP) {
      return NextResponse.json(
        { success: false, error: 'RSVP not found' },
        { status: 404 }
      );
    }

    // Delete the RSVP
    await prisma.eventRSVP.delete({
      where: {
        eventId_userId: {
          eventId: params.id,
          userId: userId
        }
      }
    });

    // Update event RSVP count
    const rsvpCount = await prisma.eventRSVP.count({
      where: { eventId: params.id }
    });

    await prisma.event.update({
      where: { id: params.id },
      data: { rsvps: rsvpCount }
    });

    return NextResponse.json({ 
      success: true, 
      message: 'RSVP removed successfully' 
    });

  } catch (error) {
    console.error('Error removing RSVP:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to remove RSVP' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
} 