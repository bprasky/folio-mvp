import { deleteProjectWithSpotlightGuard } from '@/lib/spotlight/deletion';
import { SpotlightConflict } from '@/lib/spotlight/gate';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { assertProjectDelete } from '@/lib/authz/access';

/**
 * PATCH /api/deletion-requests/[id]
 * Body: { action: 'approve' | 'decline' }
 * Owner/Admin resolves a pending deletion request. Approving deletes the
 * project (which cascades the request away); declining keeps the project.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: requestId } = await params;

    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = session.user.id;

    const body = await request.json().catch(() => ({}));
    const action = body?.action;
    if (action !== 'approve' && action !== 'decline') {
      return NextResponse.json(
        { error: "action must be 'approve' or 'decline'" },
        { status: 400 }
      );
    }

    const req = await prisma.projectDeletionRequest.findUnique({
      where: { id: requestId },
      select: { id: true, projectId: true, status: true },
    });
    if (!req) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }
    if (req.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'This request has already been resolved.' },
        { status: 409 }
      );
    }

    // Only someone who could delete the project may resolve the request.
    try {
      await assertProjectDelete(userId, req.projectId);
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      if (msg === 'NotFound') {
        // Project is already gone — clean up the stale request.
        await prisma.projectDeletionRequest
          .updateMany({
            where: { id: requestId, status: 'PENDING' },
            data: { status: 'APPROVED', resolvedById: userId, resolvedAt: new Date() },
          })
          .catch(() => {});
        return NextResponse.json({ resolved: true, projectDeleted: true });
      }
      return NextResponse.json(
        { error: 'You do not have permission to resolve this request.' },
        { status: 403 }
      );
    }

    if (action === 'decline') {
      await prisma.projectDeletionRequest.update({
        where: { id: requestId },
        data: { status: 'DECLINED', resolvedById: userId, resolvedAt: new Date() },
      });
      return NextResponse.json({ resolved: true, projectDeleted: false });
    }

    // approve → delete the project. The deletion request cascades away with it.
    await deleteProjectWithSpotlightGuard(req.projectId);
    return NextResponse.json({ resolved: true, projectDeleted: true });
  } catch (error) {
    if (error instanceof SpotlightConflict) return NextResponse.json({ code: error.code, error: error.message }, { status: error.status });
    console.error('Error resolving deletion request:', error);
    return NextResponse.json(
      { error: 'Failed to resolve deletion request' },
      { status: 500 }
    );
  }
}
