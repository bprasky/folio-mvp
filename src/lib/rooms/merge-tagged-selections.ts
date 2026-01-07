/**
 * Merge ProductTags (from tagged images) with Selections (from designer boards)
 * Prioritizes tagged items over board selections
 * Demotes duplicate product types by adding "Option 2", "Option 3" suffixes
 */

import { ProductTag, Selection, Product } from '@prisma/client';

type ProductTagWithProduct = ProductTag & {
  product: Product & {
    vendor?: { name: string | null; studio: string | null } | null;
  };
  image: { id: string; room: string | null };
};

type SelectionWithMetadata = Selection & {
  _isTagged?: boolean;
  _tagId?: string;
  _displayName?: string; // May include "Option 2", "Option 3" suffix
};

/**
 * Infer product category/type from product name or category
 * Used for duplicate detection
 */
function inferProductType(product: { name: string; category?: string | null }): string {
  const name = (product.name || '').toLowerCase();
  const category = (product.category || '').toLowerCase();
  
  // Common furniture/product types
  const types: Record<string, string> = {
    'rug': 'rug',
    'carpet': 'rug',
    'sofa': 'sofa',
    'couch': 'sofa',
    'sectional': 'sofa',
    'chair': 'chair',
    'table': 'table',
    'coffee table': 'table',
    'dining table': 'table',
    'lamp': 'lamp',
    'lighting': 'lamp',
    'pillow': 'pillow',
    'cushion': 'pillow',
    'curtain': 'curtain',
    'drape': 'curtain',
    'art': 'art',
    'painting': 'art',
    'mirror': 'mirror',
    'cabinet': 'cabinet',
    'shelf': 'shelf',
    'bed': 'bed',
    'mattress': 'bed',
    'nightstand': 'nightstand',
    'dresser': 'dresser',
  };
  
  // Check category first
  if (category) {
    for (const [key, value] of Object.entries(types)) {
      if (category.includes(key)) return value;
    }
  }
  
  // Check name
  for (const [key, value] of Object.entries(types)) {
    if (name.includes(key)) return value;
  }
  
  // Fallback: use category or generic
  return category || 'product';
}

/**
 * Merge tagged products with selections, prioritizing tagged items
 */
export function mergeTaggedSelections(
  selections: Selection[],
  productTags: ProductTagWithProduct[],
  roomId: string,
  roomName?: string
): SelectionWithMetadata[] {
  // Defensive checks
  if (!selections) selections = [];
  if (!productTags) productTags = [];
  if (!roomId) return selections as SelectionWithMetadata[];

  // Step 1: Convert ProductTags to Selection-like objects (tagged items)
  const taggedSelections: SelectionWithMetadata[] = productTags
    .filter(tag => {
      // Only include tags for images in this room
      // Match by room ID or room name (tolerant matching)
      const imageRoom = tag.image.room;
      if (!imageRoom) return false;
      // Match by ID or name (case-insensitive)
      return imageRoom === roomId || 
             (roomName && imageRoom.toLowerCase() === roomName.toLowerCase()) ||
             (roomName && imageRoom === roomName);
    })
    .map(tag => {
      if (!tag || !tag.product || !tag.image) return null;
      
      const product = tag.product;
      const vendorName = product.vendor?.name || product.vendor?.studio || null;
      
      return {
        id: `tagged-${tag.id}`, // Unique ID for tagged items
        photo: product.imageUrl || null,
        vendorName,
        productName: product.name || 'Untitled Product',
        colorFinish: null,
        notes: null,
        phaseOfUse: null,
        gpsLocation: null,
        source: 'tagged' as const,
        timestamp: tag.createdAt,
        createdAt: tag.createdAt,
        updatedAt: tag.updatedAt,
        roomId,
        projectId: tag.image.projectId || '',
        quantity: null,
        specSheetFileName: null,
        specSheetUrl: null,
        unitPrice: null,
        vendorProductId: product.id,
        vendorRepId: null,
        productUrl: product.productUrl || null,
        tags: product.category ? [product.category] : [],
        slotKey: null,
        metadata: null,
        _isTagged: true,
        _tagId: tag.id,
        _displayName: product.name || 'Untitled Product',
      } as SelectionWithMetadata;
    })
    .filter((item): item is SelectionWithMetadata => item !== null);

  // Step 2: Group by product type for duplicate detection
  const byType = new Map<string, SelectionWithMetadata[]>();
  
  // Add tagged items first (they get priority)
  for (const tagged of taggedSelections) {
    const type = inferProductType({
      name: tagged.productName || '',
      category: tagged.tags?.[0] || null,
    });
    const existing = byType.get(type) || [];
    existing.push(tagged);
    byType.set(type, existing);
  }
  
  // Add board selections, checking for duplicates
  for (const selection of selections) {
    const type = inferProductType({
      name: selection.productName || '',
      category: selection.tags?.[0] || null,
    });
    
    const existing = byType.get(type) || [];
    const isDuplicate = existing.length > 0;
    
    // If duplicate, add suffix to demote it
    const displayName = selection.productName || 'Product';
    const suffix = isDuplicate ? ` (Option ${existing.length + 1})` : '';
    
    const selectionWithMetadata: SelectionWithMetadata = {
      ...selection,
      _isTagged: false,
      _displayName: displayName + suffix,
    };
    
    existing.push(selectionWithMetadata);
    byType.set(type, existing);
  }
  
  // Step 3: Flatten and sort (tagged first, then by type, then by creation date)
  const merged: SelectionWithMetadata[] = [];
  
  for (const [type, items] of byType.entries()) {
    // Sort: tagged items first, then by creation date
    items.sort((a, b) => {
      if (a._isTagged && !b._isTagged) return -1;
      if (!a._isTagged && b._isTagged) return 1;
      return a.createdAt.getTime() - b.createdAt.getTime();
    });
    
    merged.push(...items);
  }
  
  // Final sort: tagged items first, then by type, then by date
  merged.sort((a, b) => {
    if (a._isTagged && !b._isTagged) return -1;
    if (!a._isTagged && b._isTagged) return 1;
    
    const aType = inferProductType({
      name: a.productName || '',
      category: a.tags?.[0] || null,
    });
    const bType = inferProductType({
      name: b.productName || '',
      category: b.tags?.[0] || null,
    });
    
    if (aType !== bType) return aType.localeCompare(bType);
    
    return a.createdAt.getTime() - b.createdAt.getTime();
  });
  
  return merged;
}

