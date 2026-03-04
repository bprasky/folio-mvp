export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { assertProjectView } from '@/lib/authz/access';

const prisma = new PrismaClient();

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    await assertProjectView(session.user.id, params.id);

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
    const csvRows: string[][] = [];
    
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
    if (error instanceof Error && error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Error exporting project:', error);
    return NextResponse.json(
      { error: 'Failed to export project', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 