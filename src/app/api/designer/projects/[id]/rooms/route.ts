import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { MOCK_PROJECTS } from '@/lib/mock/designer';

const prisma = new PrismaClient();

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: projectId } = params;

    // Fetch real rooms from Prisma
    const rooms = await prisma.room.findMany({
      where: { 
        projectId,
        project: { 
          OR: [
            { ownerId: session.user.id },
            { designerId: session.user.id }
          ]
        }
      },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
    
    return NextResponse.json({ rooms });
  } catch (error) {
    console.error('Error fetching rooms:', error);
    return NextResponse.json(
      { error: 'Failed to fetch rooms', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

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