export const dynamic = 'force-dynamic';

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

    // Ensure a Product record exists for the attribution chain:
    // Selection → ProductTag → Product → VendorInvite
    let linkedProductId: string | null = null;

    if (productName) {
      // Try to find an existing Product by exact name match
      const existing = await prisma.product.findFirst({
        where: { name: { equals: productName, mode: 'insensitive' } },
        select: { id: true },
      });

      if (existing) {
        linkedProductId = existing.id;
      } else {
        // Create a new Product from the selection data
        const product = await prisma.product.create({
          data: {
            name: productName,
            brand: vendorName || null,
            imageUrl: photo || null,
            price: unitPrice ? Number(unitPrice) : null,
            url: productUrl || null,
          },
          select: { id: true },
        });
        linkedProductId = product.id;
        console.log(`[selections] Created Product "${productName}" (${product.id})`);
      }
    }

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
