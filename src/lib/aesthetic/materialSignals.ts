import { MaterialSignals } from './types';

const NATURAL_MATERIALS = new Set([
  'wood', 'stone', 'marble', 'granite', 'quartz', 'limestone',
  'bamboo', 'cork', 'rattan', 'jute', 'linen', 'cotton',
  'wool', 'leather', 'ceramic', 'terracotta', 'clay',
  'concrete', 'brick', 'slate', 'travertine'
]);

const METAL_MATERIALS = new Set([
  'brass', 'bronze', 'copper', 'gold', 'silver', 'nickel',
  'steel', 'iron', 'chrome', 'aluminum', 'zinc'
]);

const SYNTHETIC_MATERIALS = new Set([
  'plastic', 'vinyl', 'acrylic', 'polyester', 'nylon',
  'fiberglass', 'laminates', 'composite', 'resin', 'pvc'
]);

/**
 * Extract material signals from product tags and room data
 */
export function extractMaterialSignals(
  productTags: Array<{ product: { category?: string; materials?: string[] } }>,
  rooms: Array<{ type: string; materials?: string[] }>
): MaterialSignals {
  const materialCounts: Record<string, number> = {};
  let naturalCount = 0;
  let metalCount = 0;
  let syntheticCount = 0;
  
  // Process product tags
  for (const tag of productTags) {
    const materials = tag.product.materials || [];
    for (const material of materials) {
      const normalized = material.toLowerCase().trim();
      materialCounts[normalized] = (materialCounts[normalized] || 0) + 1;
      
      if (NATURAL_MATERIALS.has(normalized)) {
        naturalCount++;
      } else if (METAL_MATERIALS.has(normalized)) {
        metalCount++;
      } else if (SYNTHETIC_MATERIALS.has(normalized)) {
        syntheticCount++;
      }
    }
  }
  
  // Process room materials
  for (const room of rooms) {
    const materials = room.materials || [];
    for (const material of materials) {
      const normalized = material.toLowerCase().trim();
      materialCounts[normalized] = (materialCounts[normalized] || 0) + 1;
      
      if (NATURAL_MATERIALS.has(normalized)) {
        naturalCount++;
      } else if (METAL_MATERIALS.has(normalized)) {
        metalCount++;
      } else if (SYNTHETIC_MATERIALS.has(normalized)) {
        syntheticCount++;
      }
    }
  }
  
  // Get dominant materials (top 5)
  const dominantMaterials = Object.entries(materialCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([material]) => material);
  
  return {
    naturalMaterials: naturalCount,
    metalMaterials: metalCount,
    syntheticMaterials: syntheticCount,
    dominantMaterials,
  };
}


