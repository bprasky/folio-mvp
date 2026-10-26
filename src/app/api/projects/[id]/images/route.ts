export const dynamic = 'force-dynamic';

import { requestIdentity } from '@/lib/persistence/requestIdentity';
import { projectPhotoError } from '@/lib/files/projectPhoto';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { assertProjectWrite } from '@/lib/authz/access';
import { revalidatePath } from 'next/cache';
import { saveBufferToProjectStorage, deleteProjectImage } from '@/lib/storage';
import { decodeImage, fetchProjectImage, readImageBody, ImageInputError } from '@/lib/server/project-image-input';
import { UnsafeProductUrl } from '@/lib/server/safe-product-url';
import { indexMoment } from '@/lib/search/indexMoment';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  let storedUpload: { bucket: string; path: string } | undefined;
  let persisted = false;
  let sharedUpload = false;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const projectId = params.id;
    const userId = session.user.id;

    // Check project access
    await assertProjectWrite(userId, projectId);

    const body = await readImageBody(request);
    const { name, room } = body;
    if (Boolean(body.url) === Boolean(body.imageData) ||
        (body.mimeType !== undefined && !['image/jpeg', 'image/png', 'image/webp'].includes(body.mimeType))) {
      throw new ImageInputError('Invalid photograph input.');
    }
    if ((name != null && (typeof name !== 'string' || name.length > 500)) ||
        (room != null && (typeof room !== 'string' || room.length > 200))) {
      throw new ImageInputError('Invalid photograph name or room.');
    }
    let source: { buffer: Buffer; mime: string };
    if (body.imageData) {
      source = { buffer: decodeImage(body.imageData), mime: typeof body.mimeType === 'string' ? body.mimeType : 'image/jpeg' };
    } else if (typeof body.url === 'string' && body.url.startsWith('data:image/')) {
      const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.*)$/.exec(body.url);
      if (!match) throw new ImageInputError('Invalid photograph data.');
      source = { buffer: decodeImage(match[2]), mime: match[1] };
    } else if (typeof body.url === 'string') {
      source = await fetchProjectImage(body.url);
    } else {
      throw new ImageInputError('Image URL or image data is required');
    }
    if (body.deduplicate === true && body.imageData) {
      const validation = projectPhotoError(source.mime, source.buffer.length);
      if (validation) throw new ImageInputError(validation, 422);
    }
    const imageId = body.deduplicate === true ? requestIdentity('photo-upload', [projectId, source.buffer.toString('base64'), source.mime]) : undefined;
    const include = { tags: { include: { product: true } } };
    if (imageId) {
      const saved = await prisma.projectImage.findUnique({ where: { id: imageId }, include });
      if (saved) return NextResponse.json({ success: true, image: saved }, { status: 200 });
      sharedUpload = true;
    }
    // Every path is decoded/sanitized by storage. Never persist an unverified URL.
    const stored = await saveBufferToProjectStorage({
      projectId, roomId: imageId ? 'default' : room || 'default', ...source, storageId: imageId,
    });
    storedUpload = stored;
    const url = stored.publicUrl;

    // Create ProjectImage record
    const image = await prisma.projectImage.create({
      data: {
        ...(imageId ? { id: imageId } : {}),
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
    }).catch(async error => {
      if (imageId && error?.code === 'P2002') {
        const saved = await prisma.projectImage.findUnique({ where: { id: imageId }, include });
        if (saved) return saved;
      }
      throw error;
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
    // Only compensate objects exclusively owned by this request. A deterministic
    // path may already belong to a concurrent winner; retain it for safe retry.
    if (storedUpload && !persisted && !sharedUpload) {
      try { await deleteProjectImage(`${storedUpload.bucket}/${storedUpload.path}`); }
      catch { console.error('[project image] Failed to clean up unlinked upload'); }
    }
    if (error instanceof ImageInputError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof UnsafeProductUrl) return NextResponse.json({ error: 'This photo link cannot be imported. Upload the file instead.' }, { status: 400 });
    if (typeof error.message === 'string' && error.message.startsWith('Forbidden')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('[POST /api/projects/[id]/images] Error:', error);
    return NextResponse.json(
      { error: 'Failed to upload image. Your other saved photos are safe; please retry.' },
      { status: 500 }
    );
  }
}


