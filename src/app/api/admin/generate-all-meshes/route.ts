export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { callSam3DService } from '@/lib/three-d/sam3d-client';
import { uploadGeneratedMesh } from '@/lib/storage';
import { isMeshableCategory } from '@/lib/three-d/categories';

const BATCH_SIZE = 3;
const BATCH_DELAY_MS = 2000;

/**
 * POST /api/admin/generate-all-meshes
 *
 * Admin-only endpoint to backfill 3D meshes for all products with images but no mesh.
 * Processes in batches of 3 with 2s delay between batches.
 *
 * Query params:
 *   limit?: number (default 50, max 500)
 *   dryRun?: boolean (default false) — preview eligible products without generating
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== 'ADMIN') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const url = new URL(request.url);
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 500);
  const dryRun = url.searchParams.get('dryRun') === 'true';

  // Find eligible products: has image, no mesh, not currently processing
  const eligible = await prisma.product.findMany({
    where: {
      imageUrl: { not: null },
      threeDAssetUrl: null,
      mesh3dStatus: { notIn: ['processing'] },
    },
    select: {
      id: true,
      name: true,
      imageUrl: true,
      category: true,
    },
    take: limit,
    orderBy: { createdAt: 'desc' },
  });

  // Filter to meshable categories
  const meshable = eligible.filter((p) => isMeshableCategory(p.category));

  if (dryRun) {
    return NextResponse.json({
      dryRun: true,
      totalEligible: eligible.length,
      meshableCount: meshable.length,
      skippedFlat: eligible.length - meshable.length,
      products: meshable.map((p) => ({ id: p.id, name: p.name, category: p.category })),
    });
  }

  // Process in batches
  const results: Array<{ id: string; name: string; status: string; error?: string }> = [];
  let processed = 0;
  let failed = 0;

  for (let i = 0; i < meshable.length; i += BATCH_SIZE) {
    const batch = meshable.slice(i, i + BATCH_SIZE);

    // Process batch sequentially (fal.ai rate limits)
    for (const product of batch) {
      try {
        // Mark as processing
        await prisma.product.update({
          where: { id: product.id },
          data: { mesh3dStatus: 'processing', mesh3dError: null },
        });

        const meshResult = await callSam3DService({
          imageUrl: product.imageUrl!,
          productId: product.id,
        });

        const upload = await uploadGeneratedMesh({
          projectId: 'admin-backfill',
          productId: product.id,
          buffer: meshResult.glbBuffer,
          mime: 'application/octet-stream',
        });

        await prisma.product.update({
          where: { id: product.id },
          data: {
            threeDAssetUrl: upload.publicUrl,
            mesh3dStatus: 'complete',
            mesh3dGeneratedAt: new Date(),
            mesh3dError: null,
          },
        });

        results.push({ id: product.id, name: product.name, status: 'success' });
        processed++;
        console.log(`[admin-backfill] ${processed}/${meshable.length} complete: ${product.name}`);
      } catch (error: any) {
        await prisma.product.update({
          where: { id: product.id },
          data: { mesh3dStatus: 'failed', mesh3dError: error.message },
        }).catch(() => {});

        results.push({ id: product.id, name: product.name, status: 'failed', error: error.message });
        failed++;
        console.error(`[admin-backfill] Failed: ${product.name}`, error.message);
      }
    }

    // Delay between batches (skip after last batch)
    if (i + BATCH_SIZE < meshable.length) {
      await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS));
    }
  }

  return NextResponse.json({
    totalEligible: eligible.length,
    meshableCount: meshable.length,
    processed,
    failed,
    results,
  });
}
