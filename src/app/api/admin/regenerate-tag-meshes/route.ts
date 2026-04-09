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
 * Admin-only: regenerate 3D meshes at tag level using Trellis.
 * Processes 1 tag per request to avoid gateway timeouts.
 *
 * Query params:
 *   dryRun?:      boolean — preview eligible tags
 *   force?:       boolean — re-generate even completed tags
 *   catalogOnly?: boolean — only tags with Product.imageUrl
 *   tagId?:       string — target a specific tag
 *   productName?: string — target by product name (partial match)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any).role !== 'ADMIN') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const url = new URL(request.url);
    const dryRun = url.searchParams.get('dryRun') === 'true';
    const force = url.searchParams.get('force') === 'true';
    const catalogOnly = url.searchParams.get('catalogOnly') === 'true';
    const targetTagId = url.searchParams.get('tagId');
    const targetName = url.searchParams.get('productName');

    // Build where clause
    const meshWhere: any = {};

    // Target specific tag
    if (targetTagId) {
      meshWhere.id = targetTagId;
    }

    // Target by product name
    if (targetName) {
      meshWhere.product = {
        ...meshWhere.product,
        name: { contains: targetName, mode: 'insensitive' },
      };
    }

    // Only catalog-image products
    if (catalogOnly) {
      meshWhere.product = {
        ...meshWhere.product,
        imageUrl: { not: null },
      };
    }

    // Status filter (unless targeting specific tag)
    if (!targetTagId && !force) {
      meshWhere.OR = [
        { meshStatus: { equals: null } },
        { meshStatus: 'failed' },
        { meshStatus: '' },
      ];
    } else if (!targetTagId) {
      meshWhere.meshStatus = { not: 'processing' };
    }

    // Fetch eligible tags
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
          select: { id: true, url: true, projectId: true },
        },
        product: {
          select: { id: true, name: true, category: true, imageUrl: true },
        },
      },
      take: dryRun ? 200 : 1,
      orderBy: { createdAt: 'desc' },
    });

    // Filter to meshable categories (unless targeting specific tag)
    const meshable = targetTagId
      ? eligible
      : eligible.filter((t) => isMeshableCategory(t.product?.category));

    if (dryRun) {
      return NextResponse.json({
        dryRun: true,
        force,
        catalogOnly,
        totalFound: meshable.length,
        tags: meshable.map((t) => ({
          id: t.id,
          productName: t.product?.name,
          category: t.product?.category,
          currentStatus: t.meshStatus,
          hasCatalogImage: !!t.product?.imageUrl,
          catalogImage: t.product?.imageUrl?.substring(0, 80),
          sourceImage: t.image?.url?.substring(0, 80),
        })),
      });
    }

    // Process the single tag
    const tag = meshable[0];
    if (!tag) {
      return NextResponse.json({ processed: 0, failed: 0, message: 'No eligible tags found' });
    }

    const productName = tag.product?.name || 'Unknown';

    try {
      if (!tag.image?.url) {
        return NextResponse.json({
          processed: 0, failed: 1,
          results: [{ id: tag.id, productName, status: 'skipped', error: 'No source image' }],
        });
      }

      // Mark as processing
      await prisma.productTag.update({
        where: { id: tag.id },
        data: { meshStatus: 'processing', meshError: null },
      });

      const catalogUrl = tag.product?.imageUrl || undefined;
      console.log(`[regenerate-tags] Starting: ${productName}`, {
        useCatalog: !!catalogUrl,
        catalogUrl: catalogUrl?.substring(0, 80),
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

      // Promote to Product.threeDAssetUrl
      await promoteCanonicalMesh(tag.productId);

      return NextResponse.json({
        processed: 1,
        failed: 0,
        results: [{
          id: tag.id,
          productName,
          status: 'success',
          usedCatalogImage: !!catalogUrl,
          meshUrl: meshUpload.publicUrl,
        }],
      });

    } catch (error: any) {
      await prisma.productTag.update({
        where: { id: tag.id },
        data: { meshStatus: 'failed', meshError: error.message },
      }).catch(() => {});

      return NextResponse.json({
        processed: 0,
        failed: 1,
        results: [{
          id: tag.id,
          productName,
          status: 'failed',
          usedCatalogImage: !!tag.product?.imageUrl,
          error: error.message,
        }],
      });
    }

  } catch (error: any) {
    console.error('[regenerate-tag-meshes] Unhandled error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error', stack: error.stack?.split('\n').slice(0, 5) },
      { status: 500 },
    );
  }
}
