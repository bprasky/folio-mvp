export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { assertProjectWrite } from '@/lib/authz/access';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; roomId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    await assertProjectWrite(session.user.id, params.id);

    const body = await request.json();
    // These are the fields the capture UI actually sends
    // (designer/projects/[id]/rooms/[roomId]/page.tsx, handleCameraCaptureSave).
    // It never sent `vendorId`, which this route used to read and write — and
    // Selection has no such column anyway.
    const {
      photo,
      notes,
      vendorName,
      productName,
      colorFinish,
      phaseOfUse,
      gpsLocation,
      source,
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

    // Create the selection.
    //
    // The old version could never succeed and lost data even in principle:
    //   - it wrote `vendorId`, which Selection has no column for, so Prisma
    //     rejected the whole create (surfaced as the 500 below);
    //   - it omitted `projectId`, which is required (`String`, no default);
    //   - and it persisted only photo/notes, silently discarding the six other
    //     fields the capture UI sends — every one of which is a real column.
    // The "current schema fields only" comment it carried was the opposite of
    // what it did.
    const selection = await prisma.selection.create({
      data: {
        projectId: params.id,
        roomId: params.roomId,
        photo: photo || null,
        notes: notes || null,
        vendorName: vendorName || null,
        productName: productName || null,
        colorFinish: colorFinish || null,
        phaseOfUse: phaseOfUse || null,
        gpsLocation: gpsLocation || null,
        source: source || null,
      }
    });

    return NextResponse.json(selection, { status: 201 });
  } catch (error) {
    console.error('Error creating selection:', error);
    return NextResponse.json(
      { error: 'Failed to create selection', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 