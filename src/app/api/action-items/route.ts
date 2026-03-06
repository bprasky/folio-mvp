export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { assertProjectWrite } from '@/lib/authz/access';

/**
 * GET /api/action-items
 * List action items with optional filters
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const roomId = searchParams.get('roomId');
    const productTagId = searchParams.get('productTagId');
    const status = searchParams.get('status');
    const assignedToId = searchParams.get('assignedToId');

    // Build where clause
    const where: any = {};

    // Scope filters (exactly one should be set)
    if (projectId) {
      where.projectId = projectId;
      // Verify project access
      const project = await prisma.project.findFirst({
        where: { id: projectId, ownerId: session.user.id },
      });
      if (!project) {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 });
      }
    } else if (roomId) {
      where.roomId = roomId;
      // Verify room belongs to accessible project
      const room = await prisma.room.findFirst({
        where: { id: roomId },
        include: { project: true },
      });
      if (!room || room.project.ownerId !== session.user.id) {
        return NextResponse.json({ error: 'Room not found' }, { status: 404 });
      }
    } else if (productTagId) {
      where.productTagId = productTagId;
      // Verify tag belongs to accessible project
      const tag = await prisma.projectProductTag.findFirst({
        where: { id: productTagId },
        include: { project: true },
      });
      if (!tag || tag.project.ownerId !== session.user.id) {
        return NextResponse.json({ error: 'Product tag not found' }, { status: 404 });
      }
    } else {
      return NextResponse.json(
        { error: 'One of projectId, roomId, or productTagId is required' },
        { status: 400 }
      );
    }

    // Status filter
    if (status) {
      where.status = status;
    }

    // Assigned to filter
    if (assignedToId) {
      where.assignedToId = assignedToId;
    }

    const actionItems = await prisma.actionItem.findMany({
      where,
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
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    return NextResponse.json(actionItems);
  } catch (error) {
    console.error('Error fetching action items:', error);
    return NextResponse.json(
      { error: 'Failed to fetch action items' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/action-items
 * Create a new action item
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      title,
      description,
      status = 'PENDING',
      priority = 'MEDIUM',
      sourceNoteId,
      projectId,
      roomId,
      productTagId,
      assignedToId,
      dueDate,
    } = body as {
      title: string;
      description?: string;
      status?: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
      priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
      sourceNoteId?: string;
      projectId?: string;
      roomId?: string;
      productTagId?: string;
      assignedToId?: string;
      dueDate?: string;
    };

    if (!title) {
      return NextResponse.json(
        { error: 'title is required' },
        { status: 400 }
      );
    }

    // Validate exactly one scope is set
    const scopeCount = [projectId, roomId, productTagId].filter(Boolean).length;
    if (scopeCount !== 1) {
      return NextResponse.json(
        { error: 'Exactly one of projectId, roomId, or productTagId must be set' },
        { status: 400 }
      );
    }

    // Verify project access
    let projectIdToCheck: string;
    if (projectId) {
      projectIdToCheck = projectId;
    } else if (roomId) {
      const room = await prisma.room.findFirst({
        where: { id: roomId },
        include: { project: true },
      });
      if (!room || room.project.ownerId !== session.user.id) {
        return NextResponse.json({ error: 'Room not found' }, { status: 404 });
      }
      projectIdToCheck = room.projectId;
    } else if (productTagId) {
      const tag = await prisma.projectProductTag.findFirst({
        where: { id: productTagId },
        include: { project: true },
      });
      if (!tag || tag.project.ownerId !== session.user.id) {
        return NextResponse.json({ error: 'Product tag not found' }, { status: 404 });
      }
      projectIdToCheck = tag.projectId;
    } else {
      return NextResponse.json(
        { error: 'Invalid scope' },
        { status: 400 }
      );
    }

    // Verify project write access (owner, designer, org member, or admin)
    try {
      await assertProjectWrite(session.user.id, projectIdToCheck);
    } catch (e: any) {
      if (e.message === "NotFound") {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 });
      }
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Verify source note if provided
    if (sourceNoteId) {
      const note = await prisma.meetingNote.findFirst({
        where: { id: sourceNoteId, projectId: projectIdToCheck },
      });
      if (!note) {
        return NextResponse.json(
          { error: 'Source note not found in project' },
          { status: 400 }
        );
      }
    }

    // Create action item
    const actionItem = await prisma.actionItem.create({
      data: {
        title,
        description: description || null,
        status,
        priority,
        sourceNoteId: sourceNoteId || null,
        projectId: projectId || null,
        roomId: roomId || null,
        productTagId: productTagId || null,
        assignedToId: assignedToId || null,
        createdById: session.user.id,
        dueDate: dueDate ? new Date(dueDate) : null,
      },
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

    return NextResponse.json(actionItem, { status: 201 });
  } catch (error) {
    console.error('Error creating action item:', error);
    return NextResponse.json(
      { error: 'Failed to create action item' },
      { status: 500 }
    );
  }
}








