import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { name, type } = body;

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: 'Room name is required' },
        { status: 400 }
      );
    }

    // Verify project exists
    const project = await prisma.project.findUnique({
      where: { id: params.id }
    });

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // Create the room
    const room = await prisma.room.create({
      data: {
        name: name.trim(),
        type: type || null,
        projectId: params.id
      },
      include: {
        selections: true
      }
    });

    return NextResponse.json(room, { status: 201 });
  } catch (error) {
    console.error('Error creating room:', error);
    return NextResponse.json(
      { error: 'Failed to create room', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 