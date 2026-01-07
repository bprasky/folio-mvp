import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; roomId: string } }
) {
  try {
    const { id: projectId, roomId } = params;

    const room = await prisma.room.findFirst({
      where: {
        id: roomId,
        projectId: projectId,
      },
      include: {
        selections: {
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });

    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    return NextResponse.json(room);
  } catch (error) {
    console.error('Error fetching room:', error);
    return NextResponse.json(
      { error: 'Failed to fetch room' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string; roomId: string } }
) {
  try {
    const { id: projectId, roomId } = params;
    const body = await request.json();

    const room = await prisma.room.update({
      where: {
        id: roomId,
        projectId: projectId,
      },
      data: {
        name: body.name,
      },
      include: {
        selections: {
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });

    return NextResponse.json(room);
  } catch (error) {
    console.error('Error updating room:', error);
    return NextResponse.json(
      { error: 'Failed to update room' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; roomId: string } }
) {
  try {
    const { id: projectId, roomId } = params;

    // Delete all selections in the room first
    await prisma.selection.deleteMany({
      where: {
        roomId: roomId,
      },
    });

    // Delete the room
    await prisma.room.delete({
      where: {
        id: roomId,
        projectId: projectId,
      },
    });

    return NextResponse.json({ message: 'Room deleted successfully' });
  } catch (error) {
    console.error('Error deleting room:', error);
    return NextResponse.json(
      { error: 'Failed to delete room' },
      { status: 500 }
    );
  }
} 