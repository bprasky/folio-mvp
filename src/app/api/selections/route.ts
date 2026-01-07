import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      productName, 
      vendorName, 
      productUrl, 
      photo, 
      notes, 
      unitPrice, 
      vendorProductId,
      projectId,
      roomId,
      slotKey,
      uiMeta
    } = body;

    // Validate required fields
    if (!projectId) {
      return NextResponse.json(
        { error: 'projectId is required' },
        { status: 400 }
      );
    }

    // Create the selection
    const newSelection = await prisma.selection.create({
      data: {
        productName,
        vendorName,
        productUrl,
        photo,
        notes,
        unitPrice,
        vendorProductId,
        projectId,
        roomId,
        slotKey,
        uiMeta
      }
    });

    console.log('Selection created successfully:', {
      id: newSelection.id,
      productName: newSelection.productName,
      projectId: newSelection.projectId,
      roomId: newSelection.roomId
    });

    return NextResponse.json({
      success: true,
      selection: newSelection
    });
  } catch (error) {
    console.error('Error creating selection:', error);
    return NextResponse.json(
      { error: 'Failed to create selection' },
      { status: 500 }
    );
  }
}
