/**
 * Product category classification for 3D mesh generation eligibility.
 *
 * 3D products (furniture, lighting, etc.) get SAM 3D mesh generation.
 * 2D/flat products (wallpaper, tile, textiles) get an expand modal instead.
 */

// Categories eligible for 3D mesh generation — discrete physical objects
export const MESHABLE_CATEGORIES = [
  'FURNITURE',
  'LIGHTING',
  'FIXTURES',
  'HARDWARE',
  'ACCESSORIES',
  'APPLIANCES',
  'RUG',
];

// Categories that are inherently flat/2D — shown in expand modal instead
export const FLAT_CATEGORIES = [
  'TEXTILES',
  'MATERIALS',
  'ART',
  'OTHER',
  // Also match lowercase variants from older data
  'tile',
  'textile',
  'fabric',
  'paint',
  'wallpaper',
];

/**
 * Check if a product category is eligible for 3D mesh generation.
 * Returns true for furniture, lighting, fixtures, hardware, accessories, appliances, rugs.
 * Returns false for textiles, materials, art, tile, wallpaper, paint, fabric.
 * Defaults to true if category is unknown (try mesh, fall back gracefully).
 */
export function isMeshableCategory(category?: string | null): boolean {
  if (!category) return true;
  const upper = category.toUpperCase();
  if (FLAT_CATEGORIES.map(c => c.toUpperCase()).includes(upper)) return false;
  return true;
}
