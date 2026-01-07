import { ProductDraft } from '@/types/vendor-product';
import { ScrapeResult, Confidence } from '@/types/scrape';

/**
 * Merge scraped data with current draft, respecting user edits
 * @param current Current product draft state
 * @param scraped Scraped data with confidence scores
 * @param touched Set of field paths that user has manually edited
 * @returns Updated draft with scraped values filled in
 */
export function mergeDraftWithScrape(
  current: Partial<ProductDraft>,
  scraped: ScrapeResult,
  touched: Set<string>
): Partial<ProductDraft> {
  const next: Partial<ProductDraft> = { ...current };

  // Helper to set a value only if conditions are met
  const put = (path: string, sv: { value?: any; confidence: Confidence }) => {
    if (touched.has(path)) return;                  // never overwrite user edits
    if (sv?.value == null) return;                  // only fill if present
    if (sv.confidence === 0) return;                // skip low-confidence auto-fill
    set(next, path, sv.value);                      // apply the value
  };

  // Identity fields
  put('name', scraped.identity.name);
  put('sku', scraped.identity.sku);

  // Description
  put('description', scraped.description);

  // Media - Hero
  if (scraped.media.heroVideoUrl.value) {
    put('heroMedia.type', { value: 'video', confidence: scraped.media.heroVideoUrl.confidence });
    put('heroMedia.url', scraped.media.heroVideoUrl);
  } else if (scraped.media.heroImageUrl.value) {
    put('heroMedia.type', { value: 'image', confidence: scraped.media.heroImageUrl.confidence });
    put('heroMedia.url', scraped.media.heroImageUrl);
  }

  // Media - Gallery
  if (scraped.media.gallery.value && scraped.media.gallery.value.length > 0) {
    const galleryItems = scraped.media.gallery.value.map(img => ({
      type: 'image' as const,
      url: img.url,
      alt: img.alt,
    }));
    put('gallery', { value: galleryItems, confidence: scraped.media.gallery.confidence });
  }

  // Specifications - Dimensions
  if (scraped.specs.dimensions.length.value || scraped.specs.dimensions.width.value || scraped.specs.dimensions.height.value) {
    // Try to parse dimensions into structured format
    const dims = parseDimensions(
      scraped.specs.dimensions.length.value,
      scraped.specs.dimensions.width.value,
      scraped.specs.dimensions.height.value
    );
    if (dims) {
      put('dimensions', { value: dims, confidence: 2 });
    }
  }

  // Specifications - Weight
  if (scraped.specs.weight.value.value && scraped.specs.weight.unit.value) {
    put('weight', {
      value: {
        value: scraped.specs.weight.value.value,
        units: normalizeWeightUnit(scraped.specs.weight.unit.value),
      },
      confidence: Math.min(scraped.specs.weight.value.confidence, scraped.specs.weight.unit.confidence) as Confidence,
    });
  }

  // Specifications - Materials (convert array to comma-separated string for form input)
  if (scraped.specs.materials.value && scraped.specs.materials.value.length > 0) {
    put('materials', { 
      value: scraped.specs.materials.value.join(', '), 
      confidence: scraped.specs.materials.confidence 
    });
  }

  // Specifications - Finish
  put('finish', scraped.specs.finish);

  // Specifications - Care
  put('care', scraped.specs.care);

  // Specifications - Lead Time
  put('leadTime', scraped.specs.leadTime);

  // Category (from rooms if available)
  if (scraped.specs.rooms.value && scraped.specs.rooms.value.length > 0) {
    put('category', { value: scraped.specs.rooms.value[0], confidence: scraped.specs.rooms.confidence });
  }

  // Tags (combine various scraped fields, convert to comma-separated string)
  const tags: string[] = [];
  if (scraped.specs.indoor.value) tags.push('Indoor');
  if (scraped.specs.outdoor.value) tags.push('Outdoor');
  if (scraped.specs.finish.value) tags.push(scraped.specs.finish.value);
  if (scraped.specs.materials.value) tags.push(...scraped.specs.materials.value);
  if (tags.length > 0) {
    put('tags', { value: Array.from(new Set(tags)).join(', '), confidence: 1 });
  }

  // Price
  if (scraped.commerce.msrp.value) {
    put('price', { value: scraped.commerce.msrp.value.amount, confidence: scraped.commerce.msrp.confidence });
  }

  // Source URL
  put('sourceUrl', { value: scraped.sourceUrl, confidence: 2 });

  return next;
}

/**
 * Flatten a nested object into dot-notation paths
 */
export function flatten(obj: any, prefix = ''): Record<string, any> {
  const result: Record<string, any> = {};
  
  for (const key in obj) {
    if (!Object.prototype.hasOwnProperty.call(obj, key)) continue;
    
    const path = prefix ? `${prefix}.${key}` : key;
    const value = obj[key];
    
    if (value != null && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(result, flatten(value, path));
    } else {
      result[path] = value;
    }
  }
  
  return result;
}

/**
 * Set a nested value using dot notation
 */
function set(obj: any, path: string, val: any) {
  const parts = path.split('.');
  let cur = obj;
  
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (cur[part] == null || typeof cur[part] !== 'object') {
      cur[part] = {};
    }
    cur = cur[part];
  }
  
  cur[parts[parts.length - 1]] = val;
}

/**
 * Parse dimension strings into structured format
 */
function parseDimensions(length?: string, width?: string, height?: string): { w: number; d: number; h: number; units: 'in' | 'cm' } | null {
  // Try to parse strings like "24 in", "60cm", "24\"", etc.
  const parseNum = (str?: string): { value: number; unit: string } | null => {
    if (!str) return null;
    
    // Match patterns like: 24", 24 in, 24in, 60cm, 60 cm
    const match = str.match(/^(\d+(?:\.\d+)?)\s*(?:"|''|inches?|in|cm|centimeters?|mm|millimeters?)?$/i);
    if (!match) return null;
    
    const value = parseFloat(match[1]);
    const unit = str.toLowerCase().includes('cm') || str.toLowerCase().includes('mm') ? 'cm' : 'in';
    
    return { value, unit };
  };

  const w = parseNum(width);
  const d = parseNum(length);  // length typically maps to depth
  const h = parseNum(height);

  if (!w && !d && !h) return null;

  // Use consistent unit (prefer inches)
  const units: 'in' | 'cm' = w?.unit === 'cm' || d?.unit === 'cm' || h?.unit === 'cm' ? 'cm' : 'in';

  return {
    w: w?.value || 0,
    d: d?.value || 0,
    h: h?.value || 0,
    units,
  };
}

/**
 * Normalize weight units to standard format
 */
function normalizeWeightUnit(unit: string): 'lb' | 'kg' {
  const u = unit.toLowerCase();
  if (u.includes('kg') || u.includes('kilo')) return 'kg';
  return 'lb';
}

/**
 * Collect all low-confidence or missing fields from scrape result
 */
export function collectLowConfidence(scraped: ScrapeResult): Array<{ path: string; confidence: Confidence; source?: string }> {
  const result: Array<{ path: string; confidence: Confidence; source?: string }> = [];
  
  const check = (path: string, sv: { value?: any; confidence: Confidence; source?: string }) => {
    if (sv.value == null || sv.confidence === 0) {
      result.push({ path, confidence: sv.confidence, source: sv.source });
    }
  };

  // Check all fields
  check('name', scraped.identity.name);
  check('sku', scraped.identity.sku);
  check('description', scraped.description);
  check('heroVideo', scraped.media.heroVideoUrl);
  check('heroImage', scraped.media.heroImageUrl);
  check('materials', scraped.specs.materials);
  check('finish', scraped.specs.finish);
  check('dimensions', scraped.specs.dimensions.length);
  check('weight', scraped.specs.weight.value);

  return result.sort((a, b) => a.confidence - b.confidence);
}

