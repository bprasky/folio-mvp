import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string; selectionId: string } }
) {
  try {
    const projectId = params.id;
    const selectionId = params.selectionId;
    const body = await request.json();
    const { 
      photo, 
      notes, 
      vendorName, 
      productName, 
      colorFinish, 
      unitPrice, 
      quantity,
      productUrl,
      tags,
      specSheetUrl,
      specSheetFileName
    } = body;

    // Verify the selection exists and belongs to the project
    const existingSelection = await prisma.selection.findFirst({
      where: { 
        id: selectionId,
        projectId: projectId
      }
    });

    if (!existingSelection) {
      return NextResponse.json(
        { error: 'Selection not found' },
        { status: 404 }
      );
    }

    // Update the selection
    const updatedSelection = await prisma.selection.update({
      where: { id: selectionId },
      data: {
        photo: photo !== undefined ? photo : existingSelection.photo,
        notes: notes !== undefined ? notes : existingSelection.notes,
        vendorName: vendorName !== undefined ? vendorName : existingSelection.vendorName,
        productName: productName !== undefined ? productName : existingSelection.productName,
        colorFinish: colorFinish !== undefined ? colorFinish : existingSelection.colorFinish,
        unitPrice: unitPrice !== undefined ? (unitPrice ? parseFloat(unitPrice) : null) : existingSelection.unitPrice,
        quantity: quantity !== undefined ? (quantity ? parseInt(quantity) : 1) : existingSelection.quantity,
        productUrl: productUrl !== undefined ? productUrl : existingSelection.productUrl,
        tags: tags !== undefined ? tags : existingSelection.tags,
        specSheetUrl: specSheetUrl !== undefined ? specSheetUrl : existingSelection.specSheetUrl,
        specSheetFileName: specSheetFileName !== undefined ? specSheetFileName : existingSelection.specSheetFileName
      }
    });

    console.log('Vendor selection updated successfully:', updatedSelection);
    return NextResponse.json(updatedSelection);
  } catch (error) {
    console.error('Error updating vendor selection:', error);
    return NextResponse.json(
      { error: 'Failed to update selection' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; selectionId: string } }
) {
  try {
    const projectId = params.id;
    const selectionId = params.selectionId;

    // Verify the selection exists and belongs to the project
    const existingSelection = await prisma.selection.findFirst({
      where: { 
        id: selectionId,
        projectId: projectId
      }
    });

    if (!existingSelection) {
      return NextResponse.json(
        { error: 'Selection not found' },
        { status: 404 }
      );
    }

    // Delete the selection
    await prisma.selection.delete({
      where: { id: selectionId }
    });

    console.log('Vendor selection deleted successfully:', selectionId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting vendor selection:', error);
    return NextResponse.json(
      { error: 'Failed to delete selection' },
      { status: 500 }
    );
  }
} 