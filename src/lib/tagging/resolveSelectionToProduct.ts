import { prisma } from '@/lib/prisma';

/**
 * Resolve a Selection to a Product.id suitable for creating a ProductTag.
 *
 * Resolution strategy (in priority order):
 *   0. Direct link via vendorProductId or uiMeta.productId
 *   1. CachedProduct → match Product by URL
 *   2. CachedProduct → match Product by name (case-insensitive, exact)
 *   3. Selection.productName → match Product by name (exact, case-insensitive)
 *   4. Selection.productName → match Product by name (fuzzy contains)
 *
 * Returns { productId, matchMethod } or null if no match found.
 */
export async function resolveSelectionToProduct(selection: {
  id: string;
  productName?: string | null;
  vendorName?: string | null;
}): Promise<{ productId: string; matchMethod: string } | null> {
  // 0. Direct link: check vendorProductId or uiMeta.productId on the Selection
  const sel = await prisma.selection.findUnique({
    where: { id: selection.id },
    select: { vendorProductId: true, uiMeta: true, productName: true },
  });

  if (sel?.vendorProductId) {
    const product = await prisma.product.findUnique({
      where: { id: sel.vendorProductId },
      select: { id: true },
    });
    if (product) return { productId: product.id, matchMethod: 'vendor_product_id' };
  }

  const uiProductId = (sel?.uiMeta as any)?.productId;
  if (uiProductId) {
    const product = await prisma.product.findUnique({
      where: { id: uiProductId },
      select: { id: true },
    });
    if (product) return { productId: product.id, matchMethod: 'ui_meta_product_id' };
  }

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

  // 3. Selection.productName → match existing Product by name (exact, case-insensitive)
  const productName = sel?.productName || selection.productName;
  if (productName) {
    const product = await prisma.product.findFirst({
      where: {
        name: { equals: productName, mode: 'insensitive' },
      },
      select: { id: true },
    });
    if (product) return { productId: product.id, matchMethod: 'name_exact' };
  }

  // 4. Fuzzy fallback — Selection.productName contained in Product.name
  if (productName) {
    const product = await prisma.product.findFirst({
      where: {
        name: { contains: productName, mode: 'insensitive' },
      },
      select: { id: true },
    });
    if (product) return { productId: product.id, matchMethod: 'name_fuzzy' };
  }

  return null;
}
