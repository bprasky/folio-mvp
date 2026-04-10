import { cache } from 'react';
import { prisma } from '@/lib/prisma';
import { Product } from '@/lib/mock/product';

export type ProductCompleteness = 'full' | 'partial' | 'stub';

/**
 * Server-side product completeness check from DB fields.
 */
export function getServerProductCompleteness(product: {
  imageUrl?: string | null;
  brand?: string | null;
  url?: string | null;
  vendorId?: string | null;
  name: string;
}): ProductCompleteness {
  const hasImage = !!product.imageUrl;
  const hasVendor = !!(product.brand || product.vendorId);
  const hasUrl = !!product.url;

  if (hasImage && hasVendor && hasUrl) return 'full';
  if (hasImage || hasVendor || hasUrl) return 'partial';
  return 'stub';
}

/**
 * Fetch a product from the database by ID and convert to UI format.
 * Wrapped with React cache() for request deduplication (generateMetadata + page component).
 */
export const getProductById = cache(async (id: string): Promise<(Product & {
  _completeness: ProductCompleteness;
  _vendorId: string | null;
  _vendorEmail: string | null;
  _vendorName: string | null;
  _productUrl: string | null;
}) | null> => {
  const productFromDB = await prisma.product.findUnique({
    where: { id },
    include: {
      vendor: {
        select: {
          id: true,
          name: true,
          email: true,
          companyName: true,
        },
      },
    },
  });

  if (!productFromDB) {
    return null;
  }

  // Fetch mesh color from source tag's bounding box data
  let meshColor: string | undefined;
  if (productFromDB.mesh3dSourceTagId) {
    const sourceTag = await prisma.productTag.findUnique({
      where: { id: productFromDB.mesh3dSourceTagId },
      select: { meshBoundingBox: true },
    });
    const bbox = sourceTag?.meshBoundingBox as any;
    if (bbox?.dominantColor) meshColor = bbox.dominantColor;
  }

  // Enrich with CachedProduct data (dimensions, materials) if available
  let cachedDimensions = { w: 0, d: 0, h: 0 };
  let cachedMaterials: string[] = [];
  let cachedLeadTime: string | undefined;

  if (productFromDB.url) {
    try {
      const cached = await prisma.cachedProduct.findUnique({
        where: { url: productFromDB.url },
        select: {
          widthIn: true,
          depthIn: true,
          heightIn: true,
          materialType: true,
          categories: true,
        },
      });
      if (cached) {
        cachedDimensions = {
          w: cached.widthIn ? Number(cached.widthIn) : 0,
          d: cached.depthIn ? Number(cached.depthIn) : 0,
          h: cached.heightIn ? Number(cached.heightIn) : 0,
        };
        if (cached.materialType) {
          cachedMaterials = [cached.materialType];
        }
      }
    } catch {
      // CachedProduct lookup is best-effort
    }
  }

  const completeness = getServerProductCompleteness(productFromDB);

  const product = {
    id: productFromDB.id,
    slug: productFromDB.id,
    name: productFromDB.name,
    brand: productFromDB.brand || productFromDB.vendor?.name || "",
    description: productFromDB.description || "",
    assets: productFromDB.imageUrl
      ? [{ type: "image" as const, src: productFromDB.imageUrl, alt: productFromDB.name }]
      : [],
    materials: cachedMaterials,
    finish: "",
    dimensions: { ...cachedDimensions, units: "in" as const },
    sku: productFromDB.brand || "",
    leadTime: cachedLeadTime,
    weight: undefined,
    files: { specSheets: [] as any[], _3d: [] as any[] },
    inspiration: [] as any[],
    insights: { saves: 0, tags: 0, saveToTagPct: 0, topRooms: [] as any[], topMarkets: [] as any[] },
    mesh3dUrl: productFromDB.threeDAssetUrl || undefined,
    meshColor,
    scenePresetId: (productFromDB as any).scenePresetId || undefined,
    category: productFromDB.category || undefined,
    related: [] as any[],
    // Internal fields for completeness gating
    _completeness: completeness,
    _vendorId: productFromDB.vendorId,
    _vendorEmail: productFromDB.vendor?.email || null,
    _vendorName: productFromDB.vendor?.companyName || productFromDB.vendor?.name || productFromDB.brand || null,
    _productUrl: productFromDB.url,
  };

  return product;
});
