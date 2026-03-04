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
    const projectId = params.id;
    await assertProjectView(session.user.id, projectId);

    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'csv';

    // Get project with all selections and rooms
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        vendorOrg: true,
        designerOrg: true,
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        rooms: {
          include: {
            selections: true,
          },
        },
        selections: {
          include: {
            room: true,
          },
        },
      },
    });

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    if (format === 'csv') {
      // Generate CSV content
      const csvRows = [
        // Header
        ['Project Name', 'Room', 'Product Name', 'Vendor', 'Color/Finish', 'Notes', 'Photo URL', 'Timestamp'],
      ];

      // Add selections data
      project.selections.forEach((selection) => {
        csvRows.push([
          project.name,
          selection.room?.name || 'Unassigned',
          selection.productName || '',
          selection.vendorName || '',
          selection.colorFinish || '',
          selection.notes || '',
          selection.photo || '',
          selection.timestamp?.toISOString() || '',
        ]);
      });

      // Convert to CSV string
      const csvContent = csvRows
        .map(row => row.map(cell => `"${cell || ''}"`).join(','))
        .join('\n');

      // Add CTA at the bottom
      const ctaMessage = `\n\n"Take ownership of this project in Folio to organize your selections, add additional products, and generate client-ready presentations instantly. Click here: ${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/projects/${projectId}/claim"`;

      const response = new NextResponse(csvContent + ctaMessage, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="${project.name}-selections.csv"`,
        },
      });

      return response;
    }

    // JSON format for API consumption
    return NextResponse.json({
      project: {
        id: project.id,
        name: project.name,
        description: project.description,
        vendorOrg: project.vendorOrg,
        designerOrg: project.designerOrg,
        isHandoffReady: project.isHandoffReady,
        handoffInvitedAt: project.handoffInvitedAt,
        handoffClaimedAt: project.handoffClaimedAt,
        rooms: project.rooms,
        selections: project.selections,
        claimUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/projects/${project.id}/claim`,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Error exporting project:', error);
    return NextResponse.json(
      { error: 'Failed to export project' },
      { status: 500 }
    );
  }
} 