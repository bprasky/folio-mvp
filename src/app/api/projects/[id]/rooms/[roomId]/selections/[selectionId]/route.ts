import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { assertSelectionView } from "@/lib/authz/access";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const prisma = new PrismaClient();

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string; roomId: string; selectionId: string } }
) {
  try {
    const { id: projectId, roomId, selectionId } = params;
    
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { access, selection } = await assertSelectionView(session.user.id, selectionId);
    const body = await request.json();
    const { 
      productName, 
      photo, 
      notes, 
      unitPrice, 
      quantity, 
      vendorName,
      colorFinish 
    } = body;

    if (!productName) {
      return NextResponse.json(
        { error: 'Product name is required' },
        { status: 400 }
      );
    }

    // Verify selection exists
    const existingSelection = await prisma.selection.findUnique({
      where: { id: selectionId },
    });

    if (!existingSelection) {
      return NextResponse.json(
        { error: 'Selection not found' },
        { status: 404 }
      );
    }

    // Update selection
    const selection = await prisma.selection.update({
      where: { id: selectionId },
      data: {
        productName,
        photo,
        notes,
        unitPrice: unitPrice ? parseFloat(unitPrice) : null,
        quantity: quantity ? parseInt(quantity) : null,
        vendorName,
        colorFinish,
      },
      include: {
        vendorRep: true,
        quotes: true,
      },
    });

    return NextResponse.json(selection);
  } catch (error) {
    console.error('Error updating selection:', error);
    return NextResponse.json(
      { error: 'Failed to update selection' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; roomId: string; selectionId: string } }
) {
  try {
    const { selectionId } = params;
    
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { access, selection } = await assertSelectionView(session.user.id, selectionId);

    // Verify selection exists
    const existingSelection = await prisma.selection.findUnique({
      where: { id: selectionId },
    });

    if (!existingSelection) {
      return NextResponse.json(
        { error: 'Selection not found' },
        { status: 404 }
      );
    }

    // Delete selection
    await prisma.selection.delete({
      where: { id: selectionId },
    });

    return NextResponse.json({ message: 'Selection deleted successfully' });
  } catch (error) {
    console.error('Error deleting selection:', error);
    return NextResponse.json(
      { error: 'Failed to delete selection' },
      { status: 500 }
    );
  }
} 