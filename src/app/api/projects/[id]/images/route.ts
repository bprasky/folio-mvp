export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { assertProjectWrite } from '@/lib/authz/access';
import { revalidatePath } from 'next/cache';
import { saveBufferToProjectStorage, deleteProjectImage } from '@/lib/storage';
import { z } from 'zod';
import { parseProductUrl, safeProductResource, UnsafeProductUrl } from '@/lib/server/safe-product-url';
import { indexMoment } from '@/lib/search/indexMoment';

const uploadInput = z.object({
  url: z.string().url().max(4096).optional(),
  name: z.string().max(500).nullable().optional(),
  room: z.string().max(200).nullable().optional(),
  imageData: z.string().min(4).max(20 * 1024 * 1024).regex(/^[A-Za-z0-9+/]+={0,2}$/).optional(),
  mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp']).optional(),
}).refine(value => Boolean(value.url) !== Boolean(value.imageData));

async function fetchImage(url: string, redirects = 0): Promise<{ buffer: Buffer; mime: string }> {
  if (redirects > 5) throw new UnsafeProductUrl();
  const response = await safeProductResource(url);
  if ([301, 302, 303, 307, 308].includes(response.status)) {
    if (!response.headers.location) throw new UnsafeProductUrl();
    return fetchImage(new URL(response.headers.location, url).href, redirects + 1);
  }
  const mime = response.headers['content-type']?.split(';')[0];
  if (response.status !== 200 || !['image/jpeg', 'image/png', 'image/webp'].includes(mime) || !response.body.length) {
    throw new UnsafeProductUrl();
  }
  return { buffer: response.body, mime };
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  let storedUpload: { bucket: string; path: string } | undefined;
  let persisted = false;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const projectId = params.id;
    const userId = session.user.id;

    // Check project access
    await assertProjectWrite(userId, projectId);

    const body = uploadInput.parse(await request.json());
    if (body.url) parseProductUrl(body.url);
    let { url, name, room } = body;
    const { imageData, mimeType } = body;

    // Path B (manual upload): no url, but raw base64 image data. Store it to
    // Supabase first, then proceed as if a url had been supplied.
    if (!url && imageData) {
      try {
        const buffer = Buffer.from(imageData, 'base64');
        const stored = await saveBufferToProjectStorage({
          projectId,
          roomId: room || 'default',
          buffer,
          mime: mimeType || 'image/jpeg',
        });
        storedUpload = stored;
        url = stored.publicUrl;
      } catch (uploadError: any) {
        console.error('[POST /api/projects/[id]/images] base64 upload failed:', uploadError?.message);
        return NextResponse.json({ error: 'Failed to store uploaded image' }, { status: 500 });
      }
    }

    if (!url) {
      return NextResponse.json(
        { error: 'Image URL or image data is required' },
        { status: 400 }
      );
    }

    // Only an exact storage origin is local. A substring match can be forged.
    const storageOrigin = process.env.NEXT_PUBLIC_SUPABASE_URL
      ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin : null;
    if (new URL(url).origin !== storageOrigin) {
      const { buffer, mime } = await fetchImage(url);
      const stored = await saveBufferToProjectStorage({ projectId, roomId: room || 'default', buffer, mime });
      storedUpload = stored;
      url = stored.publicUrl;
    }

    // Create ProjectImage record
    const image = await prisma.projectImage.create({
      data: {
        url,
        name: name || null,
        room: room || null,
        projectId,
      },
      include: {
        tags: {
          include: {
            product: true,
          },
        },
      },
    });

    persisted = true;

    // Index the moment for search (async, don't block response)
    indexMoment(image.id).catch(err => {
      console.error(`[POST /api/projects/[id]/images] Failed to index moment ${image.id}:`, err);
      // Don't fail the upload if indexing fails
    });

    revalidatePath(`/project/${projectId}`);
    return NextResponse.json({ 
      success: true, 
      image 
    }, { status: 201 });

  } catch (error: any) {
    // Compensate only a new object returned by this request's storage write.
    // Never derive deletion authority from a caller-supplied URL.
    if (storedUpload && !persisted) {
      try { await deleteProjectImage(`${storedUpload.bucket}/${storedUpload.path}`); }
      catch { console.error('[project image] Failed to clean up unlinked upload'); }
    }
    if (error instanceof z.ZodError || error instanceof SyntaxError || error instanceof UnsafeProductUrl) return NextResponse.json({ error: "Invalid image upload" }, { status: 400 });
    if (typeof error.message === 'string' && error.message.startsWith('Forbidden')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('[POST /api/projects/[id]/images] Error:', error);
    return NextResponse.json(
      { error: 'Failed to upload image' },
      { status: 500 }
    );
  }
}


