export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { assertProjectWrite } from '@/lib/authz/access';
import { z } from 'zod';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; imageId: string }> }
) {
  try {
    // Auth check
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: projectId, imageId } = await params;

    console.log('[DELETE image] Starting:', { projectId, imageId, userId: session.user.id });

    // Check project write access (owner, designer, org member, or admin)
    try {
      await assertProjectWrite(session.user.id, projectId);
    } catch (e: any) {
      console.log('[DELETE image] Access denied');
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Find the image
    const image = await prisma.projectImage.findFirst({
      where: {
        id: imageId,
        projectId
      }
    });

    console.log('[DELETE image] Image lookup:', image ? { id: image.id, name: image.name } : 'NOT FOUND');

    if (!image) {
      return NextResponse.json({ error: 'Image not found' }, { status: 404 });
    }

    // URLs can be shared or imported. Deleting a project reference must not
    // delete an object owned by another project (or still used elsewhere).
    // Storage reclamation requires a separately verified ownership/reference check.

    // Always hard delete - soft delete was causing images to persist
    console.log('[DELETE image] Performing hard delete for imageId:', imageId);
    const deleted = await prisma.projectImage.delete({
      where: { id: imageId, projectId }
    });
    console.log('[DELETE image] Prisma delete returned:', deleted?.id);

    // Verify deletion
    const check = await prisma.projectImage.findUnique({ where: { id: imageId } });
    console.log('[DELETE image] Verification - image still exists?:', !!check);

    console.log('[DELETE image] SUCCESS - returning 200');
    return NextResponse.json({ success: true });

  } catch (error: any) {
    if (error instanceof z.ZodError || error instanceof SyntaxError) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    console.error('Failed to delete image:', error);
    return NextResponse.json(
      { error: 'Failed to delete image' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/projects/[id]/images/[imageId]
 * Update mutable fields on an image. Currently supports `room` (the room label
 * used to group photos in the New Project Wizard's "Label Rooms" step).
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; imageId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: projectId, imageId } = await params;

    try {
      await assertProjectWrite(session.user.id, projectId);
    } catch {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const { room } = z.object({ room: z.string().trim().max(200).nullable() }).parse(await request.json());

    if (room === undefined) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
    }

    const image = await prisma.projectImage.findFirst({
      where: { id: imageId, projectId },
      select: { id: true },
    });
    if (!image) {
      return NextResponse.json({ error: 'Image not found' }, { status: 404 });
    }

    const updated = await prisma.projectImage.update({
      where: { id: imageId },
      data: { room: room?.trim() || null },
    });

    return NextResponse.json({ success: true, image: updated });
  } catch (error: any) {
    if (error instanceof z.ZodError || error instanceof SyntaxError) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    console.error('[PATCH image] Failed to update image:', error);
    return NextResponse.json({ error: 'Failed to update image' }, { status: 500 });
  }
}

