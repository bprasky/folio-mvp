import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      roomId,
      notes,
      photo
    } = body;

    console.log('📸 Testing camera capture with data:', {
      roomId,
      notes
    });

    // Create a test selection with only basic fields
    const selection = await prisma.selection.create({
      data: {
        roomId: roomId || 'test-room-id',
        notes: notes || 'Test notes from camera capture',
        photo: photo || null
      }
    });

    console.log('✅ Test selection created:', selection.id);

    return NextResponse.json({
      success: true,
      message: 'Camera capture test successful',
      selection: {
        id: selection.id,
        notes: selection.notes,
        createdAt: selection.createdAt
      }
    });
  } catch (error) {
    console.error('❌ Camera capture test failed:', error);
    return NextResponse.json(
      { 
        error: 'Camera capture test failed', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    // Get recent selections to show test data
    const recentSelections = await prisma.selection.findMany({
      take: 5,
      orderBy: {
        createdAt: 'desc'
      },
      include: {
        room: {
          include: {
            project: {
              include: {
                designer: {
                  select: {
                    name: true,
                    email: true
                  }
                }
              }
            }
          }
        }
      }
    });

    return NextResponse.json({
      message: 'Camera capture system ready',
      recentSelections: recentSelections.map(s => ({
        id: s.id,
        notes: s.notes,
        projectName: s.room.project.name,
        roomName: s.room.name,
        designerName: s.room.project.designer?.name || 'Unknown',
        createdAt: s.createdAt
      }))
    });
  } catch (error) {
    console.error('Error fetching test data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch test data' },
      { status: 500 }
    );
  }
} 