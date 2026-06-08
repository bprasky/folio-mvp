export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { assertProjectDelete } from '@/lib/authz/access';

/**
 * POST /api/projects/[id]/deletion-request
 * A member who can view a project but not delete it asks an org Owner/Admin to
 * delete it. No-ops (returns the existing request) if one is already pending.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;

    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = session.user.id;

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { designerOrgId: true, ownerId: true, designerId: true },
    });
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // A requester must be able to see the project: its owner/designer, an active
    // member of its org, or an explicit participant. (assertProjectView is too
    // strict here — it doesn't grant plain org members access, yet they're
    // exactly who sees org projects on the dashboard.)
    let canRequest = project.ownerId === userId || project.designerId === userId;
    if (!canRequest && project.designerOrgId) {
      const membership = await prisma.organizationUser.findFirst({
        where: { userId, organizationId: project.designerOrgId, isActive: true },
        select: { id: true },
      });
      canRequest = !!membership;
    }
    if (!canRequest) {
      const participant = await prisma.projectParticipant
        .findFirst({ where: { projectId, userId }, select: { id: true } })
        .catch(() => null);
      canRequest = !!participant;
    }
    if (!canRequest) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // If the user can already delete, there's nothing to request.
    let canDelete = false;
    try {
      await assertProjectDelete(userId, projectId);
      canDelete = true;
    } catch {
      canDelete = false;
    }
    if (canDelete) {
      return NextResponse.json(
        { error: 'You can delete this project directly.' },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const reason =
      typeof body?.reason === 'string' && body.reason.trim()
        ? body.reason.trim().slice(0, 1000)
        : null;

    // De-dupe: one pending request per (project, requester).
    const existing = await prisma.projectDeletionRequest.findFirst({
      where: { projectId, requestedById: userId, status: 'PENDING' },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json({ request: existing, alreadyPending: true });
    }

    const created = await prisma.projectDeletionRequest.create({
      data: {
        projectId,
        requestedById: userId,
        orgId: project.designerOrgId,
        reason,
      },
      select: { id: true, status: true },
    });

    return NextResponse.json({ request: created });
  } catch (error) {
    console.error('Error creating deletion request:', error);
    return NextResponse.json(
      { error: 'Failed to submit deletion request' },
      { status: 500 }
    );
  }
}
