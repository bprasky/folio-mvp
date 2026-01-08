export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/project-product-tags/[id]/action-items
 * Get action items for a specific product tag
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: productTagId } = params;
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    // Verify product tag exists and user has access
    const tag = await prisma.projectProductTag.findUnique({
      where: { id: productTagId },
      include: { project: true },
    });

    if (!tag) {
      return NextResponse.json({ error: 'Product tag not found' }, { status: 404 });
    }

    // Check project access
    if (tag.project.ownerId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Build where clause
    const where: any = {
      productTagId,
    };

    if (status) {
      where.status = status;
    }

    const actionItems = await prisma.actionItem.findMany({
      where,
      include: {
        sourceNote: {
          select: { id: true, title: true },
        },
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
 * POST /api/project-product-tags/[id]/action-items
 * Create an action item for a product tag
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: productTagId } = params;
    const body = await request.json();
    const {
      title,
      description,
      status = 'PENDING',
      priority = 'MEDIUM',
      sourceNoteId,
      assignedToId,
      dueDate,
    } = body as {
      title: string;
      description?: string;
      status?: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
      priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
      sourceNoteId?: string;
      assignedToId?: string;
      dueDate?: string;
    };

    if (!title) {
      return NextResponse.json(
        { error: 'title is required' },
        { status: 400 }
      );
    }

    // Verify product tag exists and user has access
    const tag = await prisma.projectProductTag.findUnique({
      where: { id: productTagId },
      include: { project: true },
    });

    if (!tag) {
      return NextResponse.json({ error: 'Product tag not found' }, { status: 404 });
    }

    // Check project access
    if (tag.project.ownerId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Verify source note if provided
    if (sourceNoteId) {
      const note = await prisma.meetingNote.findFirst({
        where: { id: sourceNoteId, projectId: tag.projectId },
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
        productTagId,
        assignedToId: assignedToId || null,
        createdById: session.user.id,
        dueDate: dueDate ? new Date(dueDate) : null,
      },
      include: {
        sourceNote: {
          select: { id: true, title: true },
        },
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








