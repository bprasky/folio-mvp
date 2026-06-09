/**
 * Image provenance gate (spec 17_IMAGE_PROVENANCE_GATE).
 *
 * Single chokepoint for deciding which product image URL may be served in a
 * given context. Public/attribution surfaces must never emit a VENDOR_REFERENCE
 * image — they fall back to the designer's in-situ crop, or null (placeholder
 * upstream). Enforce this in server queries/serializers, never in components.
 */

import type { ImageSource } from '@prisma/client';

export type RenderContext = 'INTERNAL' | 'PUBLIC';

export type ProductImageFields = {
  imageUrl: string | null;
  cutoutImageUrl: string | null;
  imageSource: ImageSource;
};

/** Classes whose image may appear on public surfaces. VENDOR_REFERENCE may not. */
export function isPubliclyDisplayable(source: ImageSource): boolean {
  return (
    source === 'VENDOR_LICENSED' ||
    source === 'DESIGNER_ORIGINAL' ||
    source === 'FOLIO_COMMISSIONED'
  );
}

/**
 * Resolve the product image URL for a render context.
 *
 * @param product        the product's image fields + provenance
 * @param insituCropUrl  ProductTag.cropUrl for the relevant tag (a crop of the
 *                       designer's own room photo — DESIGNER_ORIGINAL), or null
 * @param context        'INTERNAL' (workspace) keeps current behavior;
 *                       'PUBLIC' suppresses VENDOR_REFERENCE images
 */
export function resolveProductImage(
  product: ProductImageFields,
  insituCropUrl: string | null,
  context: RenderContext,
): string | null {
  if (context === 'INTERNAL') {
    // Workspace and project files keep current behavior: vendor image preferred.
    return product.imageUrl ?? product.cutoutImageUrl ?? insituCropUrl ?? null;
  }

  // PUBLIC: never emit a VENDOR_REFERENCE url.
  if (isPubliclyDisplayable(product.imageSource)) {
    return product.imageUrl ?? product.cutoutImageUrl ?? insituCropUrl ?? null;
  }
  // Suppressed: fall back to the designer's own in-situ crop, else placeholder upstream.
  return insituCropUrl ?? null;
}

/** Minimal select for product provenance — spread into Prisma `select`. */
export const PRODUCT_PROVENANCE_SELECT = {
  imageUrl: true,
  cutoutImageUrl: true,
  imageSource: true,
} as const;
