export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { deleteProjectImage } from '@/lib/storage';

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
    const userId = session.user.id;

    console.log('[DELETE image] Starting:', { projectId, imageId, userId });

    // Verify user has access to project - check ownerId only first
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, ownerId: true }
    });

    console.log('[DELETE image] Project:', project ? { id: project.id, ownerId: project.ownerId } : 'NOT FOUND');

    if (!project || project.ownerId !== userId) {
      console.log('[DELETE image] Access denied - user is not owner');
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

    // Check if it's a generated image (has JSON metadata in name)
    let isGeneratedImage = false;
    let metadata = null;
    try {
      metadata = JSON.parse(image.name || '{}');
      isGeneratedImage = metadata.type === 'GENERATED';
    } catch (e) {
      // Not JSON metadata - it's a regular image
      isGeneratedImage = false;
    }

    // Try to delete from storage if URL points to our storage
    if (image.url.includes('supabase') || image.url.includes('project-assets')) {
      try {
        const urlParts = image.url.split('/');
        const storageIndex = urlParts.indexOf('project-assets');
        if (storageIndex !== -1) {
          const storagePath = urlParts.slice(storageIndex).join('/');
          await deleteProjectImage(storagePath);
        }
      } catch (storageError) {
        console.warn('Storage deletion failed:', storageError);
        // Continue with database deletion even if storage fails
      }
    }

    console.log('[DELETE image] isGeneratedImage:', isGeneratedImage, 'metadata:', metadata);

    if (isGeneratedImage && metadata) {
      // Soft delete for generated images (preserve metadata)
      console.log('[DELETE image] Taking SOFT DELETE path');
      await prisma.projectImage.update({
        where: { id: imageId },
        data: {
          name: JSON.stringify({
            ...metadata,
            deletedAt: new Date().toISOString(),
            deletedBy: userId
          })
        }
      });
    } else {
      // Hard delete for regular images
      console.log('[DELETE image] Performing hard delete for imageId:', imageId);
      await prisma.projectImage.delete({
        where: { id: imageId }
      });
      console.log('[DELETE image] Hard delete completed for:', imageId);
    }

    console.log('[DELETE image] SUCCESS - returning 200');
    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('Failed to delete image:', error);
    return NextResponse.json(
      { error: 'Failed to delete image' },
      { status: 500 }
    );
  }
}

