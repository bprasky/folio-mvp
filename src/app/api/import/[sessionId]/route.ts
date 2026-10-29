import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { isWorkspaceImport } from '@/lib/workspace-import/types';

/**
 * GET /api/import/[sessionId]
 * Get import session details and status
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string })?.id;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { sessionId } = await params;

    const importSession = await prisma.importSession.findFirst({
      where: {
        id: sessionId,
        userId, // Ensure user owns this session
      },
      include: {
        _count: {
          select: { pendingTags: true },
        },
      },
    });

    if (!importSession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    if (isWorkspaceImport(importSession.processingMeta)) return NextResponse.json({ error: 'Open this import in your workspace.', href: `/onboarding/workspace?import=${sessionId}` }, { status: 409 });
    // Get status breakdown
    const statusCounts = await prisma.pendingProductTag.groupBy({
      by: ['status'],
      where: { importSessionId: sessionId },
      _count: true,
    });

    const statusBreakdown = statusCounts.reduce((acc, item) => {
      acc[item.status] = item._count;
      return acc;
    }, {} as Record<string, number>);

    return NextResponse.json({
      ...importSession,
      pendingTagsCount: importSession._count.pendingTags,
      statusBreakdown,
    });
  } catch (error) {
    console.error('Error fetching import session:', error);
    return NextResponse.json(
      { error: 'Failed to fetch import session' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/import/[sessionId]
 * Delete an import session and all pending tags
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string })?.id;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { sessionId } = await params;

    // Verify ownership
    const importSession = await prisma.importSession.findFirst({
      where: {
        id: sessionId,
        userId,
      },
    });

    if (!importSession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    if (isWorkspaceImport(importSession.processingMeta)) return NextResponse.json({ error: 'Manage this import from your workspace.' }, { status: 409 });
    // Delete session (pending tags will cascade delete)
    await prisma.importSession.delete({
      where: { id: sessionId },
    });

    return NextResponse.json({ message: 'Session deleted' });
  } catch (error) {
    console.error('Error deleting import session:', error);
    return NextResponse.json(
      { error: 'Failed to delete import session' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/import/[sessionId]
 * Update import session (e.g., mark as completed)
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string })?.id;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { sessionId } = await params;
    const body = await req.json();
    const { status, projectId } = body;

    // Verify ownership
    const importSession = await prisma.importSession.findFirst({
      where: {
        id: sessionId,
        userId,
      },
    });

    if (!importSession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    if (isWorkspaceImport(importSession.processingMeta)) return NextResponse.json({ error: 'Manage this import from your workspace.' }, { status: 409 });
    const updateData: { status?: string; projectId?: string; completedAt?: Date } = {};

    if (status) {
      const validStatuses = ['PROCESSING', 'ANALYZED', 'READY_FOR_REVIEW', 'COMPLETED', 'FAILED'];
      if (!validStatuses.includes(status)) {
        return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
      }
      updateData.status = status;
      if (status === 'COMPLETED') {
        updateData.completedAt = new Date();
      }
    }

    if (projectId) {
      // Verify project ownership
      const project = await prisma.project.findFirst({
        where: {
          id: projectId,
          OR: [{ ownerId: userId }, { designerId: userId }],
        },
      });

      if (!project) {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 });
      }

      updateData.projectId = projectId;
    }

    const updated = await prisma.importSession.update({
      where: { id: sessionId },
      data: updateData,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating import session:', error);
    return NextResponse.json(
      { error: 'Failed to update import session' },
      { status: 500 }
    );
  }
}
