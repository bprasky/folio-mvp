import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    console.log('🧪 Testing selection creation...');
    
    // Find a project with a room
    const project = await prisma.project.findFirst({
      include: {
        rooms: {
          take: 1
        }
      }
    });
    
    if (!project || project.rooms.length === 0) {
      return NextResponse.json({
        error: 'No project with rooms found',
        message: 'Please create a project and room first'
      });
    }
    
    const room = project.rooms[0];
    console.log('✅ Using project:', project.id, 'room:', room.id);
    
    // Try to create a selection with minimal data
    const selection = await prisma.selection.create({
      data: {
        photo: 'test-photo-url',
        notes: 'Test selection from API',
        vendorId: null,
        roomId: room.id
      }
    });
    
    console.log('✅ Selection created successfully:', selection.id);
    
    // Clean up
    await prisma.selection.delete({
      where: { id: selection.id }
    });
    
    console.log('✅ Test selection cleaned up');
    
    return NextResponse.json({
      success: true,
      message: 'Selection creation test passed',
      selection: {
        id: selection.id,
        photo: selection.photo,
        notes: selection.notes,
        roomId: selection.roomId
      }
    });
    
  } catch (error) {
    console.error('❌ Selection creation test failed:', error);
    return NextResponse.json({
      error: 'Selection creation test failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 