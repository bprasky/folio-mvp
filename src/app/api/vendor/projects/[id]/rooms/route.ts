import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(_req: Request, { params }: { params: { id: string }}) {
  try {
    const rooms = await prisma.room.findMany({
      where: { projectId: params.id as any },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true },
    });
    return NextResponse.json({ rooms });
  } catch (e) {
    console.warn("[Rooms GET] failed:", (e as any)?.message);
    return NextResponse.json({ rooms: [] });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const projectId = params.id;
    const body = await request.json();
    const { name } = body;

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: 'Room name is required' },
        { status: 400 }
      );
    }

    const room = await prisma.room.create({
      data: {
        name: name.trim(),
        projectId: projectId
      },
      include: {
        selections: true
      }
    });

    console.log('Vendor project room created successfully:', room);
    return NextResponse.json(room, { status: 201 });
  } catch (error) {
    console.error('Error creating vendor project room:', error);
    return NextResponse.json(
      { error: 'Failed to create room' },
      { status: 500 }
    );
  }
} 