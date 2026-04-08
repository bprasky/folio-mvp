export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { callSam3DTagService } from '@/lib/three-d/sam3d-client';
import { uploadGeneratedMesh, uploadGeneratedMask } from '@/lib/storage';
import { isMeshableCategory } from '@/lib/three-d/categories';
import { promoteCanonicalMesh } from '@/lib/three-d/promoteCanonicalMesh';

/**
 * POST /api/admin/regenerate-tag-meshes
 *
 * Admin-only: regenerate 3D meshes at tag level using Trellis (highest quality).
 * Processes a small batch per request to avoid gateway timeouts.
 * Call in a loop from the browser console to process all tags.
 *
 * Query params:
 *   batch?:  number (default 3, max 5) — tags per request
 *   dryRun?: boolean — preview eligible tags without generating
 *   force?:  boolean — re-generate even tags with meshStatus='complete'
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any).role !== 'ADMIN') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const url = new URL(request.url);
    const batch = Math.min(parseInt(url.searchParams.get('batch') || '1'), 5);
    const dryRun = url.searchParams.get('dryRun') === 'true';
    const force = url.searchParams.get('force') === 'true';

    // Build where clause — only re-process tags that need it (unless force)
    const meshWhere = force
      ? { meshStatus: { not: 'processing' } }
      : {
          OR: [
            { meshStatus: { equals: null } },
            { meshStatus: 'failed' },
            { meshStatus: '' },
          ],
        };

    // Count total remaining
    const totalRemaining = await prisma.productTag.count({ where: meshWhere });

    // Fetch batch of eligible tags
    const eligible = await prisma.productTag.findMany({
      where: meshWhere,
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
            imageUrl: true,
          },
        },
      },
      take: dryRun ? 200 : batch,
      orderBy: { createdAt: 'desc' },
    });

    // Filter to meshable categories
    const meshable = eligible.filter((t) => isMeshableCategory(t.product?.category));

    if (dryRun) {
      return NextResponse.json({
        dryRun: true,
        force,
        totalRemaining,
        meshableCount: meshable.length,
        skippedFlat: eligible.length - meshable.length,
        tags: meshable.map((t) => ({
          id: t.id,
          productName: t.product?.name,
          category: t.product?.category,
          currentStatus: t.meshStatus,
          hasMesh: !!t.mesh3dUrl,
          hasCatalogImage: !!t.product?.imageUrl,
          catalogImage: t.product?.imageUrl?.substring(0, 80),
          sourceImage: t.image?.url?.substring(0, 80),
        })),
      });
    }

    // Process this batch sequentially
    const results: Array<{ id: string; productName: string; status: string; error?: string }> = [];
    let processed = 0;
    let failed = 0;

    for (const tag of meshable) {
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

        const catalogUrl = tag.product?.imageUrl || undefined;
        console.log(`[regenerate-tags] Starting: ${productName}`, {
          useCatalog: !!catalogUrl,
        });

        // Generate mesh: prefer catalog image, fall back to room photo + SAM isolation
        const result = await callSam3DTagService({
          sourceImageUrl: tag.image.url,
          catalogImageUrl: catalogUrl,
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
        console.log(`[regenerate-tags] Complete: ${productName}`);
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

    const remaining = totalRemaining - processed;

    return NextResponse.json({
      force,
      batchSize: batch,
      processed,
      failed,
      remaining,
      done: remaining <= 0,
      results,
    });

  } catch (error: any) {
    console.error('[regenerate-tag-meshes] Unhandled error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error', stack: error.stack?.split('\n').slice(0, 5) },
      { status: 500 },
    );
  }
}
