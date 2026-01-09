export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';

/**
 * PATCH /api/action-items/[id]
 * Update an action item
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;
    const body = await request.json();
    const {
      title,
      description,
      status,
      priority,
      assignedToId,
      dueDate,
    } = body as {
      title?: string;
      description?: string;
      status?: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
      priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
      assignedToId?: string | null;
      dueDate?: string | null;
    };

    // Fetch action item with project for permission check
    const actionItem = await prisma.actionItem.findUnique({
      where: { id },
      include: {
        project: true,
        room: { include: { project: true } },
        productTag: { include: { project: true } },
      },
    });

    if (!actionItem) {
      return NextResponse.json({ error: 'Action item not found' }, { status: 404 });
    }

    // Get project ID for permission check
    const projectId = actionItem.projectId || 
                     actionItem.room?.projectId || 
                     actionItem.productTag?.projectId;

    if (!projectId) {
      return NextResponse.json(
        { error: 'Invalid action item scope' },
        { status: 400 }
      );
    }

    // Verify project access
    const project = await prisma.project.findFirst({
      where: { id: projectId, ownerId: session.user.id },
    });

    if (!project) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Build update data
    const updateData: any = {};

    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (status !== undefined) {
      updateData.status = status;
      // Set completedAt if status is COMPLETED
      if (status === 'COMPLETED' && !actionItem.completedAt) {
        updateData.completedAt = new Date();
      } else if (status !== 'COMPLETED') {
        updateData.completedAt = null;
      }
    }
    if (priority !== undefined) updateData.priority = priority;
    if (assignedToId !== undefined) updateData.assignedToId = assignedToId;
    if (dueDate !== undefined) {
      updateData.dueDate = dueDate ? new Date(dueDate) : null;
    }

    // Update action item
    const updated = await prisma.actionItem.update({
      where: { id },
      data: updateData,
      include: {
        sourceNote: {
          select: { id: true, title: true },
        },
        project: { select: { id: true, title: true } },
        room: { select: { id: true, name: true } },
        productTag: {
          include: {
            product: { select: { id: true, name: true } },
          },
        },
        assignedTo: { select: { id: true, name: true, email: true } },
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating action item:', error);
    return NextResponse.json(
      { error: 'Failed to update action item' },
      { status: 500 }
    );
  }
}








