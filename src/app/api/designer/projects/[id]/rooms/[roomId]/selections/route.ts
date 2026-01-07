import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; roomId: string } }
) {
  try {
    const body = await request.json();
    const { 
      photo, 
      notes, 
      vendorId
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

    // Create the selection with current schema fields only
    const selection = await prisma.selection.create({
      data: {
        photo: photo || null,
        notes: notes || null,
        vendorId: vendorId || null,
        roomId: params.roomId
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