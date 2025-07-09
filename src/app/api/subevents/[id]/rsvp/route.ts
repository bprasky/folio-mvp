import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { userId, isPublic = true } = body;

    // Check if user already RSVP'd
    const existingRSVP = await prisma.subEventRSVP.findFirst({
      where: {
        subEventId: params.id,
        userId: userId
      }
    });

    if (existingRSVP) {
      // Update existing RSVP
      const updatedRSVP = await prisma.subEventRSVP.update({
        where: { id: existingRSVP.id },
        data: { isPublic },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              profileImage: true,
              profileType: true,
            }
          }
        }
      });
      return NextResponse.json(updatedRSVP);
    }

    // Create new RSVP
    const newRSVP = await prisma.subEventRSVP.create({
      data: {
        subEventId: params.id,
        userId: userId,
        isPublic
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            profileImage: true,
            profileType: true,
          }
        }
      }
    });

    return NextResponse.json(newRSVP);

  } catch (error) {
    console.error('Error creating RSVP:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
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
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    const rsvp = await prisma.subEventRSVP.findFirst({
      where: {
        subEventId: params.id,
        userId: userId
      }
    });

    if (!rsvp) {
      return NextResponse.json({ error: 'RSVP not found' }, { status: 404 });
    }

    await prisma.subEventRSVP.delete({
      where: { id: rsvp.id }
    });

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Error deleting RSVP:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 