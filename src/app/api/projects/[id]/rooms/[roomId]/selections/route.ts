import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { assertProjectView } from "@/lib/authz/access";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const prisma = new PrismaClient();

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; roomId: string } }
) {
  try {
    const { id: projectId, roomId } = params;
    
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const access = await assertProjectView(session.user.id, projectId);
    const body = await request.json();
    const { 
      productName, 
      photo, 
      notes, 
      unitPrice, 
      quantity, 
      vendorRepId, 
      vendorProductId,
      colorFinish,
      vendorName,
      specSheetUrl,
      specSheetFileName
    } = body;

    if (!productName) {
      return NextResponse.json(
        { error: 'Product name is required' },
        { status: 400 }
      );
    }

    // Verify project and room exist
    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    const room = await prisma.room.findUnique({
      where: { id: roomId },
    });

    if (!room) {
      return NextResponse.json(
        { error: 'Room not found' },
        { status: 404 }
      );
    }

    // Create selection
    const selection = await prisma.selection.create({
      data: {
        productName,
        photo,
        notes,
        unitPrice: unitPrice ? parseFloat(unitPrice) : null,
        quantity: quantity ? parseInt(quantity) : null,
        vendorRepId,
        vendorProductId,
        colorFinish,
        vendorName,
        specSheetUrl,
        specSheetFileName,
        roomId,
        projectId,
      },
    });

    return NextResponse.json(selection);
  } catch (error) {
    console.error('Error creating selection:', error);
    return NextResponse.json(
      { error: 'Failed to create selection' },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; roomId: string } }
) {
  try {
    const { id: projectId, roomId } = params;
    
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const access = await assertProjectView(session.user.id, projectId);

    const selections = await prisma.selection.findMany({
      where: { 
        projectId,
        roomId,
      },
      include: {
        vendorRep: true,
        quotes: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json(selections);
  } catch (error) {
    console.error('Error fetching selections:', error);
    return NextResponse.json(
      { error: 'Failed to fetch selections' },
      { status: 500 }
    );
  }
} 