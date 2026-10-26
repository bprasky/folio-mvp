import { readProtectedProjectPhoto } from '@/lib/server/protected-project-photo';
import { fetchProjectImage } from '@/lib/server/project-image-input';
import { assertProjectWrite } from '@/lib/authz/access';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { assertProjectAccess } from '@/lib/permissions';
import { prisma } from '@/lib/prisma';
import { saveBufferToProjectStorage } from '@/lib/storage';

/**
 * POST /api/projects/[id]/images/[imageId]/save-to-project
 * Copy a generated image from one project to another.
 *
 * Body: { targetProjectId: string, targetRoomId?: string }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; imageId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const { id: sourceProjectId, imageId } = params;

    // Verify access to source project
    const sourceAccess = await assertProjectAccess({ projectId: sourceProjectId, userId, role: session.user.role });
    if (!sourceAccess.ok) {
      return NextResponse.json({ error: sourceAccess.reason }, { status: sourceAccess.status });
    }

    // Parse body
    const body = await request.json().catch(() => ({}));
    const { targetProjectId, targetRoomId } = body;

    if (!targetProjectId) {
      return NextResponse.json({ error: "targetProjectId is required" }, { status: 400 });
    }

    // Verify access to target project
    const targetAccess = await assertProjectAccess({ projectId: targetProjectId, userId, role: session.user.role });
    if (!targetAccess.ok) {
      return NextResponse.json({ error: "No access to target project" }, { status: 403 });
    }

    // Find the source image
    const sourceImage = await prisma.projectImage.findFirst({
      where: {
        id: imageId,
        projectId: sourceProjectId,
      },
      select: {
        id: true,
        url: true,
        name: true,
        room: true,
      },
    });

    if (!sourceImage) {
      return NextResponse.json({ error: "Image not found" }, { status: 404 });
    }

    await assertProjectWrite(userId, targetProjectId);
    const source = await readProtectedProjectPhoto(sourceImage.url, sourceProjectId) || await fetchProjectImage(sourceImage.url);
    const buffer = source.buffer, contentType = source.mime;

    // Save to target project storage
    const { publicUrl } = await saveBufferToProjectStorage({
      projectId: targetProjectId,
      roomId: targetRoomId || sourceImage.room || undefined,
      buffer,
      mime: contentType,
    });

    // Parse metadata from source image name (if it contains JSON)
    let metadata: any = {};
    try {
      if (sourceImage.name && sourceImage.name.startsWith('{')) {
        metadata = JSON.parse(sourceImage.name);
        // Add copy metadata
        metadata.copiedFrom = {
          projectId: sourceProjectId,
          imageId: sourceImage.id,
          copiedAt: new Date().toISOString(),
          copiedBy: userId,
        };
      }
    } catch {
      // Name is not JSON, just use as-is
    }

    // Create new ProjectImage record
    const newImage = await prisma.projectImage.create({
      data: {
        url: publicUrl,
        name: metadata.type ? JSON.stringify(metadata) : sourceImage.name,
        room: targetRoomId || sourceImage.room,
        projectId: targetProjectId,
      },
      select: {
        id: true,
        url: true,
      },
    });

    return NextResponse.json({
      ok: true,
      image: newImage,
      targetProjectId,
    });
  } catch (error: any) {
    console.error('[save-to-project] Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to save image to project' },
      { status: 500 }
    );
  }
}
