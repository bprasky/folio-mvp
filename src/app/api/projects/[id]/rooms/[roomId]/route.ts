export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { assertProjectView } from '@/lib/authz/access';

const prisma = new PrismaClient();

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; roomId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { id: projectId, roomId } = params;
    await assertProjectView(session.user.id, projectId);

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
    if (error instanceof Error && error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
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
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { id: projectId, roomId } = params;
    await assertProjectView(session.user.id, projectId);

    const body = await request.json();

    // Build update data - only include fields that are provided
    const updateData: { name?: string; type?: string | null } = {};
    if (body.name !== undefined) {
      updateData.name = body.name;
    }
    if (body.type !== undefined) {
      updateData.type = body.type; // Can be null to clear the type
    }

    const room = await prisma.room.update({
      where: {
        id: roomId,
        projectId: projectId,
      },
      data: updateData,
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
    if (error instanceof Error && error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
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
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { id: projectId, roomId } = params;
    await assertProjectView(session.user.id, projectId);

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
    if (error instanceof Error && error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Error deleting room:', error);
    return NextResponse.json(
      { error: 'Failed to delete room' },
      { status: 500 }
    );
  }
} 