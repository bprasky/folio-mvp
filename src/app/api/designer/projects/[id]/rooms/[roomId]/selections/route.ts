export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { assertProjectView } from '@/lib/authz/access';

const prisma = new PrismaClient();

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; roomId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    await assertProjectView(session.user.id, params.id);

    const body = await request.json();
    const {
      photo,
      notes,
      vendorId
    } = body;

    // Verify room exists and belongs to the project
    const room = await prisma.room.findUnique({
      where: { 
        id: params.roomId,
        projectId: params.id
      }
    });

    if (!room) {
      return NextResponse.json(
        { error: 'Room not found' },
        { status: 404 }
      );
    }

    // Create the selection with current schema fields only
    const selection = await prisma.selection.create({
      data: {
        photo: photo || null,
        notes: notes || null,
        vendorId: vendorId || null,
        roomId: params.roomId
      }
    });

    return NextResponse.json(selection, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Error creating selection:', error);
    return NextResponse.json(
      { error: 'Failed to create selection', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 