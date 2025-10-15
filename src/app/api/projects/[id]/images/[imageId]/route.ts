import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { deleteProjectImage } from '@/lib/storage';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; imageId: string } }
) {
  try {
    // Auth check
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: projectId, imageId } = params;
    const userId = session.user.id;

    // Verify user has access to project
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        OR: [
          { ownerId: userId },
          { designerId: userId }
        ]
      }
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Find the image
    const image = await prisma.projectImage.findFirst({
      where: {
        id: imageId,
        projectId
      }
    });

    if (!image) {
      return NextResponse.json({ error: 'Image not found' }, { status: 404 });
    }

    // Parse metadata to check if it's a generated image
    let metadata = null;
    try {
      metadata = JSON.parse(image.name || '{}');
    } catch (e) {
      return NextResponse.json({ error: 'Invalid image metadata' }, { status: 400 });
    }

    if (metadata.type !== 'GENERATED') {
      return NextResponse.json({ error: 'Not a generated image' }, { status: 400 });
    }

    // Extract storage path from URL for deletion
    // This is a simplified approach - in production you'd want more robust URL parsing
    const urlParts = image.url.split('/');
    const storagePath = urlParts.slice(urlParts.indexOf('project-assets')).join('/');

    // Delete from storage
    try {
      await deleteProjectImage(storagePath);
    } catch (storageError) {
      console.warn('Storage deletion failed:', storageError);
      // Continue with database deletion even if storage fails
    }

    // Soft delete from database (mark as deleted instead of hard delete)
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

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('Failed to delete image:', error);
    return NextResponse.json(
      { error: 'Failed to delete image' },
      { status: 500 }
    );
  }
}

