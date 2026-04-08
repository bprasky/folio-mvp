import { prisma } from '@/lib/prisma';
import { callSam3DService } from './sam3d-client';
import { uploadGeneratedMesh } from '@/lib/storage';
import { isMeshableCategory } from './categories';

/**
 * Fire-and-forget mesh generation for a product.
 * Checks eligibility, generates via Trellis (primary) or TripoSR@512 (fallback),
 * uploads to Supabase Storage, and updates the product record.
 *
 * Safe to call from any product creation/update path — catches all errors silently.
 */
export function triggerMeshGeneration(productId: string, imageUrl: string): void {
  // Fire and forget — no await
  generateMeshSafe(productId, imageUrl).catch(() => {});
}

async function generateMeshSafe(productId: string, imageUrl: string): Promise<void> {
  try {
    // Check if product already has a mesh or is ineligible
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { threeDAssetUrl: true, category: true, mesh3dStatus: true },
    });

    if (!product) return;
    if (product.threeDAssetUrl) return; // already has mesh
    if (product.mesh3dStatus === 'processing') return; // already in progress
    if (!isMeshableCategory(product.category)) return; // flat category

    // Mark as processing
    await prisma.product.update({
      where: { id: productId },
      data: { mesh3dStatus: 'processing', mesh3dError: null },
    });

    console.log('[triggerMeshGeneration] Starting mesh generation', {
      productId,
      imageUrl: imageUrl.substring(0, 80),
    });

    const result = await callSam3DService({ imageUrl, productId });

    const upload = await uploadGeneratedMesh({
      projectId: 'auto-generated',
      productId,
      buffer: result.glbBuffer,
      mime: 'application/octet-stream',
    });

    await prisma.product.update({
      where: { id: productId },
      data: {
        threeDAssetUrl: upload.publicUrl,
        mesh3dStatus: 'complete',
        mesh3dGeneratedAt: new Date(),
        mesh3dError: null,
      },
    });

    console.log('[triggerMeshGeneration] Complete', {
      productId,
      glbSize: result.glbBuffer.length,
      url: upload.publicUrl.substring(0, 80),
    });
  } catch (error: any) {
    console.error('[triggerMeshGeneration] Failed (non-fatal)', {
      productId,
      error: error.message,
    });

    // Mark as failed but don't throw
    await prisma.product.update({
      where: { id: productId },
      data: {
        mesh3dStatus: 'failed',
        mesh3dError: error.message || 'Unknown error',
      },
    }).catch(() => {});
  }
}
