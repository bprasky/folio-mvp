export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { callSam3DTagService } from '@/lib/three-d/sam3d-client';
import { uploadGeneratedMesh } from '@/lib/storage';
import { uploadGeneratedMask } from '@/lib/storage';
import { promoteCanonicalMesh } from '@/lib/three-d/promoteCanonicalMesh';

export async function POST(
  request: NextRequest,
  { params }: { params: { tagId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tag = await prisma.productTag.findUnique({
      where: { id: params.tagId },
      include: {
        image: {
          select: {
            id: true,
            url: true,
            projectId: true,
          },
        },
        product: {
          select: {
            id: true,
            name: true,
            category: true,
          },
        },
      },
    });

    if (!tag) {
      return NextResponse.json({ error: 'Tag not found' }, { status: 404 });
    }

    if (!tag.image?.url) {
      return NextResponse.json(
        { error: 'Source image not available' },
        { status: 400 }
      );
    }

    // Already processed — return existing data
    if (tag.meshStatus === 'complete' && tag.mesh3dUrl) {
      return NextResponse.json({
        status: 'already_exists',
        mesh3dUrl: tag.mesh3dUrl,
        meshMaskUrl: tag.meshMaskUrl,
      });
    }

    // Mark as processing
    await prisma.productTag.update({
      where: { id: tag.id },
      data: { meshStatus: 'processing', meshError: null },
    });

    const body = await request.json().catch(() => ({}));

    // Call SAM 3D tag service (currently stubbed)
    const result = await callSam3DTagService({
      sourceImageUrl: tag.image.url,
      tagX: tag.x,
      tagY: tag.y,
      productId: tag.productId,
      tagId: tag.id,
      prompt: body.prompt || tag.product?.name,
    });

    const projectId = tag.image.projectId || 'standalone';

    // Upload mesh and mask in parallel
    const [meshUpload, maskUpload] = await Promise.all([
      uploadGeneratedMesh({
        projectId,
        productId: tag.productId,
        buffer: result.glbBuffer,
        mime: 'application/octet-stream',
      }),
      uploadGeneratedMask({
        projectId,
        tagId: tag.id,
        buffer: result.maskPngBuffer,
        mime: 'image/png',
      }),
    ]);

    // Update ProductTag with all mesh metadata
    await prisma.productTag.update({
      where: { id: tag.id },
      data: {
        mesh3dUrl: meshUpload.publicUrl,
        meshMaskUrl: maskUpload.publicUrl,
        meshStatus: 'complete',
        meshConfidence: result.confidence,
        meshBoundingBox: result.boundingBox,
        meshDepthEstimate: result.depthEstimate,
        meshGeneratedAt: new Date(),
        meshError: null,
      },
    });

    // Promote to canonical product mesh if this is the best
    await promoteCanonicalMesh(tag.productId);

    return NextResponse.json({
      status: 'success',
      mesh3dUrl: meshUpload.publicUrl,
      meshMaskUrl: maskUpload.publicUrl,
      confidence: result.confidence,
    });
  } catch (error: any) {
    console.error('[generate-3d-tag] Error:', {
      tagId: params.tagId,
      error: error.message,
    });

    // Mark as failed
    await prisma.productTag.update({
      where: { id: params.tagId },
      data: {
        meshStatus: 'failed',
        meshError: error.message || 'Unknown error',
      },
    }).catch(() => {}); // Don't fail if the tag update fails

    return NextResponse.json(
      { status: 'failed', error: error.message || 'Unknown error' },
      { status: 200 } // Soft failure
    );
  }
}
