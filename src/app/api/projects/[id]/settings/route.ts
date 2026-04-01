export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';

/**
 * PATCH /api/projects/[id]/settings
 * Update project settings (targetInstallDate, etc.)
 * Body: { targetInstallDate?: string | null }
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

    const project = await prisma.project.findUnique({
      where: { id: params.id },
      select: { ownerId: true },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    if (project.ownerId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const updates: Record<string, unknown> = {};

    if ('targetInstallDate' in body) {
      updates.targetInstallDate = body.targetInstallDate
        ? new Date(body.targetInstallDate)
        : null;
    }

    const updated = await prisma.project.update({
      where: { id: params.id },
      data: updates,
      select: { id: true, targetInstallDate: true },
    });

    return NextResponse.json({ project: updated });
  } catch (error) {
    console.error('[API] project settings PATCH error:', error);
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}
