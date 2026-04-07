import { prisma } from '@/lib/prisma';

/**
 * Promote the highest-confidence tag mesh as the canonical product mesh.
 *
 * Called after each tag-level mesh generation. Compares all completed
 * tag meshes for a product and promotes the best one to Product.threeDAssetUrl.
 */
export async function promoteCanonicalMesh(productId: string): Promise<void> {
  // Find all completed tag meshes for this product, sorted by confidence desc
  const completedTags = await prisma.productTag.findMany({
    where: {
      productId,
      meshStatus: 'complete',
      mesh3dUrl: { not: null },
      meshConfidence: { not: null },
    },
    orderBy: { meshConfidence: 'desc' },
    select: {
      id: true,
      mesh3dUrl: true,
      meshConfidence: true,
    },
    take: 1,
  });

  if (completedTags.length === 0) return;

  const bestTag = completedTags[0];

  // Check if this tag's mesh is better than the current canonical
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: {
      threeDAssetUrl: true,
      mesh3dSourceTagId: true,
    },
  });

  if (!product) return;

  // If no canonical exists, or this tag is different from current source, promote
  const currentSourceTag = product.mesh3dSourceTagId;
  if (currentSourceTag === bestTag.id && product.threeDAssetUrl) {
    // Already the canonical — no update needed
    return;
  }

  await prisma.product.update({
    where: { id: productId },
    data: {
      threeDAssetUrl: bestTag.mesh3dUrl,
      mesh3dStatus: 'complete',
      mesh3dSourceTagId: bestTag.id,
      mesh3dGeneratedAt: new Date(),
      mesh3dError: null,
    },
  });
}
