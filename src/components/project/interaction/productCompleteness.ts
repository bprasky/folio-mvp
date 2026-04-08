import type { NormalizedTag } from './types';

export type ProductCompleteness = 'full' | 'partial' | 'stub';

/**
 * Determine product completeness tier from tag data.
 * Controls interaction behavior — stubs are hidden, partials get reduced UX.
 */
export function getProductCompleteness(tag: NormalizedTag): ProductCompleteness {
  const hasImage = !!(tag.thumbnailUrl || tag.cutoutImageUrl);
  const hasVendor = !!(tag.vendorName);
  const hasLink = !!(tag.href);
  const hasRealName = tag.label !== 'Tagged product' && tag.label.trim().length > 0;

  if (!hasRealName) return 'stub';

  // Full: name + image + vendor + link
  if (hasImage && hasVendor && hasLink) return 'full';

  // Partial: name + at least one useful field
  if (hasImage || hasVendor || hasLink) return 'partial';

  // Stub: name only
  return 'stub';
}

export interface MissingField {
  key: string;
  label: string;
}

/**
 * Returns the list of fields missing for a product to reach "full" completeness.
 */
export function getMissingFields(tag: NormalizedTag): MissingField[] {
  const missing: MissingField[] = [];

  if (!tag.thumbnailUrl && !tag.cutoutImageUrl) {
    missing.push({ key: 'image', label: 'Product image' });
  }
  if (!tag.vendorName) {
    missing.push({ key: 'vendor', label: 'Vendor / brand' });
  }
  if (!tag.href) {
    missing.push({ key: 'url', label: 'Product URL' });
  }

  return missing;
}
