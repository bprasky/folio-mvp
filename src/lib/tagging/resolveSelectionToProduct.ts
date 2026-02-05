import { prisma } from '@/lib/prisma';

/**
 * Resolve a Selection to a Product.id suitable for creating a ProductTag.
 *
 * Resolution strategy (in priority order):
 *   1. CachedProduct → match Product by URL
 *   2. CachedProduct → match Product by name (case-insensitive, exact)
 *   3. Selection.productName → match Product by name (case-insensitive, contains)
 *
 * Returns { productId, matchMethod } or null if no match.
 */
export async function resolveSelectionToProduct(selection: {
  id: string;
  productName?: string | null;
  vendorName?: string | null;
}): Promise<{ productId: string; matchMethod: string } | null> {
  // 1. Try SelectionCachedProduct → CachedProduct → Product by URL
  const cachedLinks = await prisma.selectionCachedProduct.findMany({
    where: { selectionId: selection.id },
    include: {
      cachedProduct: {
        select: { url: true, productName: true },
      },
    },
    orderBy: { matchConfidence: 'desc' },
  });

  for (const link of cachedLinks) {
    if (link.cachedProduct.url) {
      const product = await prisma.product.findFirst({
        where: { url: link.cachedProduct.url },
        select: { id: true },
      });
      if (product) return { productId: product.id, matchMethod: 'cached_url' };
    }
  }

  // 2. CachedProduct → Product by name
  for (const link of cachedLinks) {
    if (link.cachedProduct.productName) {
      const product = await prisma.product.findFirst({
        where: {
          name: { equals: link.cachedProduct.productName, mode: 'insensitive' },
        },
        select: { id: true },
      });
      if (product) return { productId: product.id, matchMethod: 'cached_name' };
    }
  }

  // 3. Selection.productName → Product by name (contains, case-insensitive)
  if (selection.productName) {
    const product = await prisma.product.findFirst({
      where: {
        name: { contains: selection.productName, mode: 'insensitive' },
      },
      select: { id: true },
    });
    if (product) return { productId: product.id, matchMethod: 'name_fuzzy' };
  }

  return null;
}
