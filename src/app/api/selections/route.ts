export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ensureProductForSelection } from '@/lib/tagging/ensureProductForSelection';

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

    // Ensure a Product record exists for the attribution chain
    const linkedProductId = await ensureProductForSelection({
      productName,
      vendorName,
      photo,
      unitPrice: unitPrice ? Number(unitPrice) : null,
      productUrl,
    });

    // Merge productId into uiMeta so resolveSelectionToProduct can find it
    const mergedUiMeta = {
      ...(uiMeta || {}),
      ...(linkedProductId ? { productId: linkedProductId } : {}),
    };

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
        uiMeta: mergedUiMeta
      }
    });

    console.log('Selection created successfully:', {
      id: newSelection.id,
      productName: newSelection.productName,
      projectId: newSelection.projectId,
      roomId: newSelection.roomId,
      linkedProductId,
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
