export const dynamic = 'force-dynamic';

/**
 * API route to re-upload images from client-side (browser can access Facebook CDN)
 * POST /api/projects/[id]/images/reupload-client
 * Body: { imageId: string, imageData: string (base64), mimeType: string, room?: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { assertProjectWrite } from '@/lib/authz/access';
import { saveBufferToProjectStorage } from '@/lib/storage';
import { z } from 'zod';

const ReuploadClientRequestSchema = z.object({
  imageId: z.string().uuid(),
  imageData: z.string(), // base64 encoded image
  mimeType: z.string(),
  room: z.string().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const projectId = params.id;
    const userId = session.user.id;

    // Check project access
    await assertProjectWrite(userId, projectId);

    const body = await request.json();
    const { imageId, imageData, mimeType, room } = ReuploadClientRequestSchema.parse(body);

    // Verify image belongs to this project
    const image = await prisma.projectImage.findUnique({
      where: { id: imageId },
      select: { id: true, projectId: true, room: true },
    });

    if (!image) {
      return NextResponse.json({ error: 'Image not found' }, { status: 404 });
    }

    if (image.projectId !== projectId) {
      return NextResponse.json({ error: 'Image does not belong to this project' }, { status: 403 });
    }

    // Convert base64 to buffer
    let buffer: Buffer;
    try {
      buffer = Buffer.from(imageData, 'base64');
      if (buffer.length === 0) {
        throw new Error('Empty buffer after base64 decode');
      }
    } catch (bufferError: any) {
      console.error(`[reupload-client] Failed to decode base64 for image ${imageId}:`, bufferError);
      return NextResponse.json(
        { error: `Failed to decode image data: ${bufferError.message}` },
        { status: 400 }
      );
    }

    const roomId = room || image.room || 'default';
    console.log(`[reupload-client] Uploading image ${imageId} to Supabase, size: ${buffer.length} bytes, room: ${roomId}, mime: ${mimeType}`);

    // Upload to Supabase
    let publicUrl: string;
    try {
      const result = await saveBufferToProjectStorage({
        projectId,
        roomId,
        buffer,
        mime: mimeType,
      });
      publicUrl = result.publicUrl;
      console.log(`[reupload-client] Upload successful, publicUrl: ${publicUrl}`);
    } catch (storageError: any) {
      console.error(`[reupload-client] Storage upload failed for image ${imageId}:`, storageError);
      return NextResponse.json(
        { 
          error: `Storage upload failed: ${storageError.message || storageError.toString()}`,
          details: process.env.NODE_ENV === 'development' ? storageError.stack : undefined
        },
        { status: 500 }
      );
    }

    // Update the image record with the new Supabase URL
    try {
      await prisma.projectImage.update({
        where: { id: imageId },
        data: { url: publicUrl },
      });
      console.log(`[reupload-client] Database updated successfully for image ${imageId}`);
    } catch (dbError: any) {
      console.error(`[reupload-client] Database update failed for image ${imageId}:`, dbError);
      // An uploaded object is not a saved ProjectImage until this write succeeds.
      return NextResponse.json({
        error: 'Image upload completed, but saving the image failed. Please retry.',
      }, { status: 500 });
    }

    console.log(`[reupload-client] Successfully re-uploaded image ${imageId} to Supabase: ${publicUrl}`);

    return NextResponse.json({
      success: true,
      imageId,
      newUrl: publicUrl,
    });
  } catch (error: any) {
    if (error.message === 'NotFound') return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    if (error.message?.startsWith('Forbidden')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Invalid request', issues: error.issues },
        { status: 400 }
      );
    }
    console.error('[reupload-client] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to re-upload image' },
      { status: 500 }
    );
  }
}

