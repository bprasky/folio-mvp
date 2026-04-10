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

  // Enrich with CachedProduct data — mirror all available fields
  let cachedDimensions = { w: 0, d: 0, h: 0 };
  let cachedMaterials: string[] = [];
  let cachedSku: string | undefined;
  let cachedPrice: number | undefined;
  let cachedDescription: string | undefined;
  let cachedStyle: string | undefined;
  let cachedPriceTier: string | undefined;
  let cachedTags: string[] = [];
  let cachedCategories: string[] = [];
  let cachedColorPalette: string[] = [];
  let cachedRoomSuitability: Record<string, number> = {};
  let cachedVendorName: string | undefined;
  let cachedExtractionConfidence: string | undefined;
  let cachedBrand: string | undefined;

  if (productFromDB.url) {
    try {
      const cached = await prisma.cachedProduct.findUnique({
        where: { url: productFromDB.url },
        select: {
          widthIn: true,
          depthIn: true,
          heightIn: true,
          materialType: true,
          style: true,
          sku: true,
          priceCents: true,
          currency: true,
          description: true,
          brand: true,
          vendorName: true,
          priceTier: true,
          categories: true,
          tags: true,
          colorPalette: true,
          roomSuitability: true,
          extractionConfidence: true,
        },
      });
      if (cached) {
        cachedDimensions = {
          w: cached.widthIn ? Number(cached.widthIn) : 0,
          d: cached.depthIn ? Number(cached.depthIn) : 0,
          h: cached.heightIn ? Number(cached.heightIn) : 0,
        };
        if (cached.materialType) cachedMaterials = [cached.materialType];
        if (cached.sku) cachedSku = cached.sku;
        if (cached.priceCents) cachedPrice = cached.priceCents / 100;
        if (cached.description) cachedDescription = cached.description;
        if (cached.style) cachedStyle = cached.style;
        if (cached.priceTier) cachedPriceTier = cached.priceTier;
        if (cached.categories?.length) cachedCategories = cached.categories;
        if (cached.tags?.length) cachedTags = cached.tags;
        if (cached.brand) cachedBrand = cached.brand;
        if (cached.vendorName) cachedVendorName = cached.vendorName;
        if (cached.extractionConfidence) cachedExtractionConfidence = cached.extractionConfidence;
        if (Array.isArray(cached.colorPalette)) {
          cachedColorPalette = (cached.colorPalette as any[]).filter((c): c is string => typeof c === 'string');
        }
        if (cached.roomSuitability && typeof cached.roomSuitability === 'object' && !Array.isArray(cached.roomSuitability)) {
          cachedRoomSuitability = cached.roomSuitability as Record<string, number>;
        }
      }
    } catch {
      // CachedProduct lookup is best-effort
    }
  }

  const completeness = getServerProductCompleteness(productFromDB);

  // Build 3D file links
  const _3dFiles: any[] = [];
  if (productFromDB.threeDAssetUrl) {
    _3dFiles.push({ label: '3D Model (.glb)', href: productFromDB.threeDAssetUrl });
  }

  const product = {
    id: productFromDB.id,
    slug: productFromDB.id,
    name: productFromDB.name,
    brand: productFromDB.brand || cachedBrand || productFromDB.vendor?.companyName || productFromDB.vendor?.name || "",
    description: productFromDB.description || cachedDescription || "",
    price: productFromDB.price ?? cachedPrice,
    assets: productFromDB.imageUrl
      ? [{ type: "image" as const, src: productFromDB.imageUrl, alt: productFromDB.name }]
      : [],
    materials: cachedMaterials,
    finish: "",
    dimensions: { ...cachedDimensions, units: "in" as const },
    sku: cachedSku || productFromDB.brand || "",
    leadTime: undefined as string | undefined,
    weight: undefined as { value: number; units: "lb" | "kg" } | undefined,
    files: {
      specSheets: [{ label: 'Spec Sheet (PDF)', href: `/api/products/${productFromDB.id}/spec-sheet` }],
      _3d: _3dFiles,
    },
    inspiration: [] as any[],
    insights: { saves: 0, tags: 0, saveToTagPct: 0, topRooms: [] as any[], topMarkets: [] as any[] },
    mesh3dUrl: productFromDB.threeDAssetUrl || undefined,
    meshColor,
    scenePresetId: (productFromDB as any).scenePresetId || undefined,
    category: productFromDB.category || (cachedCategories.length > 0 ? cachedCategories[0] : undefined),
    related: [] as any[],
    // CachedProduct enrichment fields
    style: cachedStyle,
    priceTier: cachedPriceTier,
    tags: cachedTags,
    categories: cachedCategories,
    colorPalette: cachedColorPalette,
    roomSuitability: cachedRoomSuitability,
    vendorName: cachedVendorName,
    extractionConfidence: cachedExtractionConfidence,
    // Internal fields for completeness gating
    _completeness: completeness,
    _vendorId: productFromDB.vendorId,
    _vendorEmail: productFromDB.vendor?.email || null,
    _vendorName: productFromDB.vendor?.companyName || productFromDB.vendor?.name || productFromDB.brand || null,
    _productUrl: productFromDB.url,
  };

  return product;
});
