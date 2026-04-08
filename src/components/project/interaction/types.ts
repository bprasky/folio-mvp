/**
 * Shared types for the interaction design system.
 * Extracted from ImageTagDots for reuse across TaggedImage, TagLiftOff, and editorial components.
 */

import { isMeshableCategory } from '@/lib/three-d/categories';

export type InteractionLevel = 'signal' | 'explore' | 'full';

export type InteractionTier = 'full-3d' | 'mask-only' | 'expand-2d' | 'tooltip-only' | 'loading';

export interface NormalizedTag {
  id: string;
  xPercent: number;  // 0–100
  yPercent: number;  // 0–100
  label: string;
  href?: string;
  productId?: string;
  vendorName?: string | null;
  thumbnailUrl?: string | null;
  mesh3dUrl?: string | null;
  meshMaskUrl?: string | null;
  meshStatus?: string | null;
  meshBoundingBox?: { x: number; y: number; width: number; height: number } | null;
  meshDepthEstimate?: number | null;
  cutoutImageUrl?: string | null;
  category?: string | null;
}

/**
 * Normalize tags from various formats (DB, API, legacy) into a consistent shape.
 * Handles 0-1 and 0-100 coordinate ranges, multiple product data shapes.
 */
export function normalizeTags(image: any, tagsProp?: any[] | null): NormalizedTag[] {
  const raw = Array.isArray(tagsProp)
    ? tagsProp
    : Array.isArray(image?.tags)
    ? image.tags
    : [];

  return raw
    .map((tag: any, idx: number) => {
      let xPercent: number | null = null;
      let yPercent: number | null = null;

      if (typeof tag.xPercent === 'number' && typeof tag.yPercent === 'number') {
        xPercent = tag.xPercent;
        yPercent = tag.yPercent;
      } else if (typeof tag.x === 'number' && typeof tag.y === 'number') {
        if (tag.x <= 1 && tag.y <= 1) {
          xPercent = tag.x * 100;
          yPercent = tag.y * 100;
        } else {
          xPercent = tag.x;
          yPercent = tag.y;
        }
      }

      if (xPercent == null || yPercent == null) return null;

      const product = tag.product || tag.productRef || tag.productData || {};

      const label =
        product.name || product.title || tag.label || tag.productName || tag.note || 'Tagged product';

      const href = product.slug
        ? `/products/${product.slug}`
        : product.id
        ? `/products/${product.id}`
        : product.url || product.productUrl || undefined;

      const thumbnailUrl =
        product.thumbnailUrl || product.imageThumb || product.imageUrl || product.primaryImageUrl || null;

      const vendorName =
        product.vendorName || product.vendor?.name || product.vendor?.companyName || product.brand || null;

      return {
        id: String(tag.id ?? `${image?.id ?? 'img'}-tag-${idx}`),
        xPercent,
        yPercent,
        label,
        href,
        productId: product.id ? String(product.id) : undefined,
        vendorName,
        thumbnailUrl,
        mesh3dUrl: tag.mesh3dUrl || null,
        meshMaskUrl: tag.meshMaskUrl || null,
        meshStatus: tag.meshStatus || null,
        meshBoundingBox: tag.meshBoundingBox || null,
        meshDepthEstimate: tag.meshDepthEstimate ?? null,
        cutoutImageUrl: product.cutoutImageUrl || null,
        category: product.category || null,
      } as NormalizedTag;
    })
    .filter(Boolean) as NormalizedTag[];
}

/**
 * Determine the interaction tier for a tag based on its data completeness and category.
 */
export function getInteractionTier(tag: NormalizedTag): InteractionTier {
  if (!isMeshableCategory(tag.category)) return 'expand-2d';
  if (tag.meshStatus === 'processing') return 'loading';
  if (tag.mesh3dUrl && tag.meshMaskUrl) return 'full-3d';
  if (tag.meshMaskUrl) return 'mask-only';
  return 'tooltip-only';
}
