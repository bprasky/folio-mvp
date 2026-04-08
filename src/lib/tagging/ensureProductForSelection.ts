import { prisma } from '@/lib/prisma';
import { triggerMeshGeneration } from '@/lib/three-d/triggerMeshGeneration';

/**
 * Ensures a Product record exists for a selection's product data.
 * Returns the productId if a Product can be found or created, null otherwise.
 *
 * This is the single source of truth for "Selection needs a Product" logic.
 * Every code path that creates a Selection with a productName should call this.
 */
export async function ensureProductForSelection(opts: {
  productName?: string | null;
  vendorName?: string | null;
  photo?: string | null;
  unitPrice?: number | null;
  productUrl?: string | null;
}): Promise<string | null> {
  const { productName, vendorName, photo, unitPrice, productUrl } = opts;

  if (!productName) return null;

  // Try to find an existing Product by exact name (case-insensitive)
  const existing = await prisma.product.findFirst({
    where: { name: { equals: productName, mode: 'insensitive' } },
    select: { id: true },
  });

  if (existing) return existing.id;

  // Create a new Product from the selection data
  const product = await prisma.product.create({
    data: {
      name: productName,
      brand: vendorName || null,
      imageUrl: photo || null,
      price: unitPrice != null ? Number(unitPrice) : null,
      url: productUrl || null,
    },
    select: { id: true },
  });

  console.log(`[ensureProduct] Created Product "${productName}" (${product.id})`);

  // Fire-and-forget mesh generation if product has an image
  if (photo) {
    triggerMeshGeneration(product.id, photo);
  }

  return product.id;
}
