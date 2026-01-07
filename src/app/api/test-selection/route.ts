import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    console.log('🧪 Testing selection schema...');
    
    // Check existing selections to see the schema
    const existingSelections = await prisma.selection.findMany({
      take: 1
    });
    
    console.log('📋 Current selection schema:', existingSelections.length > 0 ? Object.keys(existingSelections[0]) : 'No selections found');
    
    // Check projects
    const projects = await prisma.project.findMany({
      take: 1,
      include: {
        rooms: {
          take: 1
        }
      }
    });
    
    if (projects.length === 0) {
      return NextResponse.json({
        error: 'No projects found',
        message: 'Please create a project first'
      });
    }
    
    const project = projects[0];
    console.log('✅ Found project:', project.id, project.name);
    
    // Check if project has rooms
    if (project.rooms.length === 0) {
      return NextResponse.json({
        error: 'No rooms found in project',
        message: 'Please create a room first',
        project: project
      });
    }
    
    const room = project.rooms[0];
    console.log('✅ Found room:', room.id, room.name);
    
    return NextResponse.json({
      success: true,
      message: 'Schema check completed',
      project: {
        id: project.id,
        name: project.name
      },
      room: {
        id: room.id,
        name: room.name
      },
      existingSelections: existingSelections.length,
      selectionSchema: existingSelections.length > 0 ? Object.keys(existingSelections[0]) : 'No selections to analyze'
    });
    
  } catch (error) {
    console.error('❌ Schema test failed:', error);
    return NextResponse.json({
      error: 'Schema test failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
} 