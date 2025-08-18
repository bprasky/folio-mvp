import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const projectId = params.id;
    const body = await request.json();
    const { 
      photo, 
      notes, 
      vendorName, 
      productName, 
      colorFinish, 
      unitPrice, 
      quantity,
      roomId,
      productUrl,
      tags,
      specSheetUrl,
      specSheetFileName
    } = body;

    const selection = await prisma.selection.create({
      data: {
        photo,
        notes,
        vendorName,
        productName,
        colorFinish,
        unitPrice: unitPrice ? parseFloat(unitPrice) : null,
        quantity: quantity ? parseInt(quantity) : 1,
        projectId: projectId,
        roomId: roomId || null,
        productUrl: productUrl || null,
        tags: tags || [],
        specSheetUrl: specSheetUrl || null,
        specSheetFileName: specSheetFileName || null
      }
    });

    console.log('Vendor project selection created successfully:', selection);
    return NextResponse.json(selection, { status: 201 });
  } catch (error) {
    console.error('Error creating vendor project selection:', error);
    return NextResponse.json(
      { error: 'Failed to create selection' },
      { status: 500 }
    );
  }
} 