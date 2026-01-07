import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const CreateRoomInput = z.object({
  roomName: z.string().min(1),
  roomType: z.string().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const projectId = params.id;
  const userId = session.user.id;

  // Verify project access
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { ownerId: true, designerId: true },
  });

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  if (project.ownerId !== userId && project.designerId !== userId) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { roomName, roomType } = CreateRoomInput.parse(body);

    // Check if room already exists (idempotent)
    const existingRoom = await prisma.room.findFirst({
      where: {
        projectId,
        name: { equals: roomName, mode: 'insensitive' },
      },
    });

    if (existingRoom) {
      return NextResponse.json({
        room: existingRoom,
        created: false,
        message: 'Room already exists',
      });
    }

    // Create the room
    const room = await prisma.room.create({
      data: {
        name: roomName,
        type: roomType || null,
        projectId,
      },
    });

    if (process.env.NODE_ENV === 'development') {
      console.log('[create-room] Created:', { roomId: room.id, roomName, projectId });
    }

    return NextResponse.json({
      room,
      created: true,
      message: `Room "${roomName}" created successfully`,
    });
  } catch (error: any) {
    console.error('[create-room] Error:', error);
    
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to create room' },
      { status: 500 }
    );
  }
}





