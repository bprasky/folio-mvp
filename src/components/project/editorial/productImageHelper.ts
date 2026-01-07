/**
 * productImageHelper.ts - Robust product image resolution
 * 
 * Resolves product images from multiple possible fields with fallbacks.
 * Handles nested image objects and various schema variations.
 */

interface ProductImageSource {
  imageUrl?: string | null;
  primaryImageUrl?: string | null;
  imageUrls?: string[] | null;
  images?: Array<{ url?: string; src?: string; secure_url?: string }> | null;
  thumbnailUrl?: string | null;
  // For tags
  assetUrl?: string | null;
  cutoutUrl?: string | null;
}

/**
 * Resolve the best available product image URL
 * 
 * Tries in order:
 * 1. primaryImageUrl
 * 2. imageUrls[0] (first in array)
 * 3. imageUrl
 * 4. thumbnailUrl
 * 5. images[0].url or images[0].src or images[0].secure_url
 * 6. assetUrl (from tag)
 * 7. cutoutUrl (from tag)
 * 8. null (fallback)
 */
export function resolveProductImage(product: ProductImageSource | null | undefined): string | null {
  if (!product) {
    return null;
  }

  // 1. Try primaryImageUrl (highest priority)
  if (product.primaryImageUrl && product.primaryImageUrl.trim().length > 0) {
    return product.primaryImageUrl;
  }

  // 2. Try first image in imageUrls array
  if (product.imageUrls && Array.isArray(product.imageUrls) && product.imageUrls.length > 0) {
    const firstUrl = product.imageUrls[0];
    if (firstUrl && firstUrl.trim().length > 0) {
      return firstUrl;
    }
  }

  // 3. Try imageUrl
  if (product.imageUrl && product.imageUrl.trim().length > 0) {
    return product.imageUrl;
  }

  // 4. Try thumbnailUrl
  if (product.thumbnailUrl && product.thumbnailUrl.trim().length > 0) {
    return product.thumbnailUrl;
  }

  // 5. Try images array (nested objects)
  if (product.images && Array.isArray(product.images) && product.images.length > 0) {
    const firstImage = product.images[0];
    if (firstImage) {
      if (firstImage.url && firstImage.url.trim().length > 0) {
        return firstImage.url;
      }
      if (firstImage.src && firstImage.src.trim().length > 0) {
        return firstImage.src;
      }
      if (firstImage.secure_url && firstImage.secure_url.trim().length > 0) {
        return firstImage.secure_url;
      }
    }
  }

  // 6. Try assetUrl (from tag)
  if (product.assetUrl && product.assetUrl.trim().length > 0) {
    return product.assetUrl;
  }

  // 7. Try cutoutUrl (from tag)
  if (product.cutoutUrl && product.cutoutUrl.trim().length > 0) {
    return product.cutoutUrl;
  }

  // 8. No image found
  return null;
}








