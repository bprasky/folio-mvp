export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { callSam3DTagService } from '@/lib/three-d/sam3d-client';
import { uploadGeneratedMesh, uploadGeneratedMask } from '@/lib/storage';
import { isMeshableCategory } from '@/lib/three-d/categories';
import { promoteCanonicalMesh } from '@/lib/three-d/promoteCanonicalMesh';

const BATCH_SIZE = 2;
const BATCH_DELAY_MS = 2000;

/**
 * POST /api/admin/regenerate-tag-meshes
 *
 * Admin-only: regenerate 3D meshes at tag level using Trellis (highest quality).
 * Works on ProductTags that have a source image (ProjectImage.url), which is where
 * the homepage/article products get their mesh data from.
 *
 * Query params:
 *   limit?:  number (default 50, max 200)
 *   dryRun?: boolean — preview eligible tags without generating
 *   force?:  boolean — re-generate even tags with meshStatus='complete' (upgrade quality)
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== 'ADMIN') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const url = new URL(request.url);
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 200);
  const dryRun = url.searchParams.get('dryRun') === 'true';
  const force = url.searchParams.get('force') === 'true';

  // Build where clause
  const statusFilter = force
    ? { meshStatus: { not: 'processing' } } // Re-generate everything except currently processing
    : {
        OR: [
          { meshStatus: null },
          { meshStatus: 'failed' },
          { meshStatus: { equals: '' } },
        ],
      };

  // Find eligible tags: has source image, product exists, not currently processing
  const eligible = await prisma.productTag.findMany({
    where: {
      ...statusFilter,
      image: { url: { not: null } },
      product: { id: { not: undefined } },
    } as any,
    select: {
      id: true,
      x: true,
      y: true,
      productId: true,
      meshStatus: true,
      mesh3dUrl: true,
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
    take: limit,
    orderBy: { createdAt: 'desc' },
  });

  // Filter to meshable categories
  const meshable = eligible.filter((t) => isMeshableCategory(t.product?.category));

  if (dryRun) {
    return NextResponse.json({
      dryRun: true,
      force,
      totalEligible: eligible.length,
      meshableCount: meshable.length,
      skippedFlat: eligible.length - meshable.length,
      tags: meshable.map((t) => ({
        id: t.id,
        productName: t.product?.name,
        category: t.product?.category,
        currentStatus: t.meshStatus,
        hasMesh: !!t.mesh3dUrl,
        sourceImage: t.image?.url?.substring(0, 80),
      })),
    });
  }

  // Process tags
  const results: Array<{ id: string; productName: string; status: string; error?: string }> = [];
  let processed = 0;
  let failed = 0;

  for (let i = 0; i < meshable.length; i += BATCH_SIZE) {
    const batch = meshable.slice(i, i + BATCH_SIZE);

    for (const tag of batch) {
      const productName = tag.product?.name || 'Unknown';

      try {
        if (!tag.image?.url) {
          results.push({ id: tag.id, productName, status: 'skipped', error: 'No source image' });
          continue;
        }

        // Mark as processing
        await prisma.productTag.update({
          where: { id: tag.id },
          data: { meshStatus: 'processing', meshError: null },
        });

        console.log(`[regenerate-tags] ${processed + 1}/${meshable.length} Starting: ${productName}`);

        // Generate mesh + mask using Trellis pipeline
        const result = await callSam3DTagService({
          sourceImageUrl: tag.image.url,
          tagX: tag.x,
          tagY: tag.y,
          productId: tag.productId,
          tagId: tag.id,
          prompt: productName,
        });

        const projectId = tag.image.projectId || 'regenerate';

        // Upload mesh and mask
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

        // Update tag with new mesh data
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

        // Promote best mesh to canonical Product.threeDAssetUrl
        await promoteCanonicalMesh(tag.productId);

        results.push({ id: tag.id, productName, status: 'success' });
        processed++;
        console.log(`[regenerate-tags] ${processed}/${meshable.length} Complete: ${productName}`);
      } catch (error: any) {
        await prisma.productTag.update({
          where: { id: tag.id },
          data: { meshStatus: 'failed', meshError: error.message },
        }).catch(() => {});

        results.push({ id: tag.id, productName, status: 'failed', error: error.message });
        failed++;
        console.error(`[regenerate-tags] Failed: ${productName}`, error.message);
      }
    }

    // Delay between batches
    if (i + BATCH_SIZE < meshable.length) {
      await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS));
    }
  }

  return NextResponse.json({
    force,
    totalEligible: eligible.length,
    meshableCount: meshable.length,
    processed,
    failed,
    results,
  });
}
