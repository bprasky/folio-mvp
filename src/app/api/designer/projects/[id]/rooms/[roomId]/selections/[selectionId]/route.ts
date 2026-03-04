export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { assertProjectView } from '@/lib/authz/access';

const prisma = new PrismaClient();

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; roomId: string; selectionId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    await assertProjectView(session.user.id, params.id);

    const body = await request.json();
    const { photo, notes, vendorId } = body;

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
        vendorId: vendorId !== undefined ? vendorId : selection.vendorId
      }
    });

    return NextResponse.json(updatedSelection);
  } catch (error) {
    if (error instanceof Error && error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
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
    await assertProjectView(session.user.id, params.id);

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
    if (error instanceof Error && error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Error deleting selection:', error);
    return NextResponse.json(
      { error: 'Failed to delete selection', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 