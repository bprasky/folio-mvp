/**
 * API route to re-upload external images (e.g., Facebook CDN) to Supabase
 * POST /api/projects/[id]/images/reupload
 * Body: { imageIds: string[] } - array of ProjectImage IDs to re-upload
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { assertProjectView } from '@/lib/authz/access';
import { saveBufferToProjectStorage } from '@/lib/storage';
import { z } from 'zod';

const ReuploadRequestSchema = z.object({
  imageIds: z.array(z.string().uuid()).min(1),
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
    await assertProjectView(userId, projectId);

    const body = await request.json();
    const { imageIds } = ReuploadRequestSchema.parse(body);

    // Fetch images
    const images = await prisma.projectImage.findMany({
      where: {
        id: { in: imageIds },
        projectId,
      },
    });

    if (images.length === 0) {
      return NextResponse.json({ error: 'No images found' }, { status: 404 });
    }

    const results = [];
    const errors = [];

    for (const image of images) {
      try {
        // Check if it's already a Supabase URL
        if (image.url.includes('supabase.co') || image.url.includes(process.env.NEXT_PUBLIC_SUPABASE_URL || '')) {
          results.push({
            imageId: image.id,
            status: 'skipped',
            message: 'Already a Supabase URL',
            url: image.url,
          });
          continue;
        }

        // Check if it's an external URL that needs re-uploading
        if (!image.url.startsWith('http://') && !image.url.startsWith('https://')) {
          results.push({
            imageId: image.id,
            status: 'skipped',
            message: 'Not an external URL',
            url: image.url,
          });
          continue;
        }

        console.log(`[reupload] Fetching image: ${image.url.substring(0, 100)}...`);

        // Try to fetch the image with browser-like headers
        const headers: HeadersInit = {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36',
          'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        };

        // Add Referer for Facebook CDN
        if (image.url.includes('fbcdn.net') || image.url.includes('facebook.com')) {
          headers['Referer'] = 'https://www.facebook.com/';
          headers['Origin'] = 'https://www.facebook.com/';
        }

        let response = await fetch(image.url, {
          headers,
          signal: AbortSignal.timeout(30000),
        });

        // If 403, try without Referer
        if (response.status === 403 && (image.url.includes('fbcdn.net') || image.url.includes('facebook.com'))) {
          console.log(`[reupload] 403 Forbidden, retrying without Referer...`);
          const retryHeaders = { ...headers };
          delete retryHeaders['Referer'];
          delete retryHeaders['Origin'];
          
          response = await fetch(image.url, {
            headers: retryHeaders,
            signal: AbortSignal.timeout(30000),
          });
        }

        if (!response.ok) {
          throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const contentType = response.headers.get('content-type') || 'image/jpeg';

        console.log(`[reupload] Uploading to Supabase, size: ${buffer.length} bytes`);

        // Upload to Supabase
        const { publicUrl } = await saveBufferToProjectStorage({
          projectId,
          roomId: image.room || 'default',
          buffer,
          mime: contentType,
        });

        // Update the image record with the new Supabase URL
        await prisma.projectImage.update({
          where: { id: image.id },
          data: { url: publicUrl },
        });

        results.push({
          imageId: image.id,
          status: 'success',
          message: 'Re-uploaded to Supabase',
          oldUrl: image.url,
          newUrl: publicUrl,
        });

        console.log(`[reupload] Successfully re-uploaded image ${image.id} to Supabase`);
      } catch (error: any) {
        console.error(`[reupload] Error re-uploading image ${image.id}:`, error.message);
        errors.push({
          imageId: image.id,
          status: 'error',
          message: error.message,
          url: image.url,
        });
      }
    }

    return NextResponse.json({
      success: true,
      results,
      errors,
      summary: {
        total: images.length,
        successful: results.filter(r => r.status === 'success').length,
        skipped: results.filter(r => r.status === 'skipped').length,
        failed: errors.length,
      },
    });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Invalid request', issues: error.issues },
        { status: 400 }
      );
    }
    console.error('[reupload] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to re-upload images' },
      { status: 500 }
    );
  }
}

