import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; roomId: string; selectionId: string } }
) {
  try {
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