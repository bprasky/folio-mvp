export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { assertProjectWrite } from '@/lib/authz/access';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; roomId: string; selectionId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    await assertProjectWrite(session.user.id, params.id);

    const body = await request.json();
    // `vendorId` is deliberately not read. The client sends it from a free-text
    // "Vendor ID (optional)" input, but Selection has no such column, and none of
    // the three candidates is a safe home for unvalidated text: `vendorRepId` and
    // `vendorProductId` are foreign keys (free text would dangle), and `vendorName`
    // is a guess about what the field means. Writing it wrong is worse than not
    // writing it. See docs/audits/SCHEMA_DRIFT_WRITE_SITES.md — the input needs a
    // product decision, not a mapping invented here.
    const { photo, notes } = body;

    // Verify selection exists and belongs to the room/project
    const selection = await prisma.selection.findFirst({
      where: { 
        id: params.selectionId,
        room: {
          id: params.roomId,
          projectId: params.id
        }
      }
    });

    if (!selection) {
      return NextResponse.json(
        { error: 'Selection not found' },
        { status: 404 }
      );
    }

    // Update the selection
    const updatedSelection = await prisma.selection.update({
      where: { id: params.selectionId },
      data: {
        photo: photo !== undefined ? photo : selection.photo,
        notes: notes !== undefined ? notes : selection.notes,
      }
    });

    return NextResponse.json(updatedSelection);
  } catch (error) {
    console.error('Error updating selection:', error);
    return NextResponse.json(
      { error: 'Failed to update selection', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; roomId: string; selectionId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    await assertProjectWrite(session.user.id, params.id);

    // Verify selection exists and belongs to the room/project
    const selection = await prisma.selection.findFirst({
      where: { 
        id: params.selectionId,
        room: {
          id: params.roomId,
          projectId: params.id
        }
      }
    });

    if (!selection) {
      return NextResponse.json(
        { error: 'Selection not found' },
        { status: 404 }
      );
    }

    // Delete the selection
    await prisma.selection.delete({
      where: { id: params.selectionId }
    });

    return NextResponse.json({ message: 'Selection deleted successfully' });
  } catch (error) {
    console.error('Error deleting selection:', error);
    return NextResponse.json(
      { error: 'Failed to delete selection', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 