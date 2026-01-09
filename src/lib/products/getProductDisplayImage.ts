/**
 * getProductDisplayImage.ts - Robust product image resolution utility
 *
 * Resolves the best display image URL for a product with configurable fallback logic.
 *
 * NOTE: 2D cutout images (cutoutImageUrl) from Roboflow SAM3 pipeline are currently
 * disabled by default due to corrupted purple output images from batch processing.
 * Set use2DCutout: true to re-enable when the pipeline is fixed.
 */

interface ProductImageFields {
  imageUrl?: string | null;
  cutoutImageUrl?: string | null;
  primaryImageUrl?: string | null;
  thumbnailUrl?: string | null;
}

interface GetProductDisplayImageOptions {
  /**
   * Whether to use 2D cutout images (cutoutImageUrl) from Roboflow SAM3.
   *
   * Currently defaults to FALSE because the pipeline produced corrupted
   * purple images for some products. Set to true to re-enable cutout
   * display when the pipeline is fixed.
   *
   * @default false
   */
  use2DCutout?: boolean;

  /**
   * Placeholder image to return if no image is found.
   * @default '/placeholder-product.png'
   */
  placeholder?: string;
}

/**
 * Get the best display image URL for a product.
 *
 * Fallback order (when use2DCutout is false, the default):
 * 1. primaryImageUrl
 * 2. imageUrl
 * 3. thumbnailUrl
 * 4. placeholder
 *
 * Fallback order (when use2DCutout is true):
 * 1. cutoutImageUrl (2D cutout from Roboflow SAM3)
 * 2. primaryImageUrl
 * 3. imageUrl
 * 4. thumbnailUrl
 * 5. placeholder
 *
 * @param product - Product object with image URL fields
 * @param options - Configuration options
 * @returns The best available image URL or placeholder
 *
 * @example
 * // Default: skip corrupted 2D cutouts, use catalog image
 * const displayImage = getProductDisplayImage(product);
 *
 * @example
 * // Opt-in: use 2D cutout if available (when pipeline is fixed)
 * const displayImage = getProductDisplayImage(product, { use2DCutout: true });
 */
export function getProductDisplayImage(
  product: ProductImageFields | null | undefined,
  options?: GetProductDisplayImageOptions
): string {
  const {
    use2DCutout = false, // DISABLED by default - corrupted SAM3 pipeline outputs
    placeholder = '/placeholder-product.png',
  } = options ?? {};

  if (!product) {
    return placeholder;
  }

  // If 2D cutouts are enabled and available, use them first
  if (use2DCutout && isValidUrl(product.cutoutImageUrl)) {
    return product.cutoutImageUrl!;
  }

  // Standard fallback chain (original catalog images)
  if (isValidUrl(product.primaryImageUrl)) {
    return product.primaryImageUrl!;
  }

  if (isValidUrl(product.imageUrl)) {
    return product.imageUrl!;
  }

  if (isValidUrl(product.thumbnailUrl)) {
    return product.thumbnailUrl!;
  }

  return placeholder;
}

/**
 * Check if a URL is valid (non-null, non-empty string)
 */
function isValidUrl(url: string | null | undefined): url is string {
  return typeof url === 'string' && url.trim().length > 0;
}

/**
 * Check if a product has a valid 2D cutout image available.
 * Useful for UI decisions about showing cutout badges or features.
 */
export function hasProductCutout(product: ProductImageFields | null | undefined): boolean {
  return isValidUrl(product?.cutoutImageUrl);
}
