import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Fetch project with all rooms and selections
    const project = await prisma.project.findUnique({
      where: { id: params.id },
      include: {
        rooms: {
          include: {
            selections: true
          }
        },
        designer: {
          select: {
            name: true,
            email: true
          }
        }
      }
    });

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // Generate CSV content
    const csvRows = [];
    
    // Header row
    csvRows.push([
      'Project',
      'Room',
      'Selection ID',
      'Photo URL',
      'Notes',
      'Vendor ID',
      'Created Date'
    ]);

    // Data rows
    project.rooms.forEach(room => {
      if (room.selections.length === 0) {
        // Add empty row for rooms with no selections
        csvRows.push([
          project.name,
          room.name,
          '',
          '',
          '',
          '',
          ''
        ]);
      } else {
        room.selections.forEach(selection => {
          csvRows.push([
            project.name,
            room.name,
            selection.id,
            selection.photo || '',
            selection.notes || '',
            selection.vendorId || '',
            selection.createdAt
          ]);
        });
      }
    });

    // Convert to CSV string
    const csvContent = csvRows.map(row => 
      row.map(field => `"${field}"`).join(',')
    ).join('\n');

    // Return CSV file
    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${project.name}-spec-sheet.csv"`
      }
    });
  } catch (error) {
    console.error('Error exporting project:', error);
    return NextResponse.json(
      { error: 'Failed to export project', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 