import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { 
      photo, 
      notes, 
      vendorId,
      vendorName,
      productName,
      colorFinish,
      phaseOfUse,
      gpsLocation,
      source,
      roomId // Optional - if null, it's a project-level selection
    } = body;

    // Verify project exists
    const project = await prisma.project.findUnique({
      where: { id: params.id }
    });

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // If roomId is provided, verify room exists and belongs to the project
    if (roomId) {
      const room = await prisma.room.findUnique({
        where: { 
          id: roomId,
          projectId: params.id
        }
      });

      if (!room) {
        return NextResponse.json(
          { error: 'Room not found or does not belong to this project' },
          { status: 404 }
        );
      }
    }

    // Create the selection with current schema fields
    // Note: This is a temporary fix until database schema is updated
    const selectionData: any = {
      photo: photo || null,
      notes: notes || null,
      vendorId: vendorId || null,
      roomId: roomId || null // Can be null for project-level selections
    };

    // Add new fields if they exist in the schema (will be ignored if not)
    if (vendorName !== undefined) selectionData.vendorName = vendorName;
    if (productName !== undefined) selectionData.productName = productName;
    if (colorFinish !== undefined) selectionData.colorFinish = colorFinish;
    if (phaseOfUse !== undefined) selectionData.phaseOfUse = phaseOfUse;
    if (gpsLocation !== undefined) selectionData.gpsLocation = gpsLocation;
    if (source !== undefined) selectionData.source = source;
    if (params.id !== undefined) selectionData.projectId = params.id;

    const selection = await prisma.selection.create({
      data: selectionData
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

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const roomId = searchParams.get('roomId');

    // Verify project exists
    const project = await prisma.project.findUnique({
      where: { id: params.id }
    });

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // Get selections based on filter
    let selections: any[] = [];
    if (roomId) {
      // Get room-level selections
      selections = await prisma.selection.findMany({
        where: {
          roomId: roomId
        },
        orderBy: {
          createdAt: 'desc'
        }
      });
    } else {
      // Get project-level selections (roomId = null)
      // Note: This will only work once the database schema is updated
      // For now, return empty array until schema is updated
      selections = [];
    }

    return NextResponse.json(selections);
  } catch (error) {
    console.error('Error fetching selections:', error);
    return NextResponse.json(
      { error: 'Failed to fetch selections', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 