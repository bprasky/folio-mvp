import { ProductDraft } from '@/types/vendor-product';
import { Product } from '@/lib/mock/product';

/**
 * Convert ProductDraft to Product format for cinematic page
 */
export function toCinematicProduct(draft: ProductDraft, slug: string): Product {
  return {
    id: `prod_${Date.now()}`,
    slug,
    name: draft.name,
    brand: 'Vendor Brand', // TODO: Get from vendor profile
    price: draft.price,
    description: draft.description,
    materials: draft.materials,
    finish: draft.finish,
    dimensions: draft.dimensions || { w: 0, d: 0, h: 0, units: 'in' },
    weight: draft.weight,
    sku: draft.sku,
    leadTime: draft.leadTime,
    
    // Convert media to assets array
    assets: [
      // Hero media first
      {
        type: draft.heroMedia.type,
        src: draft.heroMedia.url,
        alt: draft.heroMedia.alt,
      },
      // Then gallery items
      ...draft.gallery.map(item => ({
        type: item.type,
        src: item.url,
        alt: item.alt,
      })),
    ],
    
    // Files - convert 'url' to 'href' to match Product type
    files: {
      specSheets: draft.files.specSheets.map(f => ({ label: f.label, href: f.url })),
      _3d: draft.files._3d.map(f => ({ label: f.label, href: f.url })),
      others: draft.files.others?.map(f => ({ label: f.label, href: f.url })),
    },
    
    // Placeholder data (in production, these would come from real analytics)
    inspiration: [],
    insights: {
      saves: 0,
      tags: 0,
      saveToTagPct: 0,
      topRooms: [],
      topMarkets: [],
    },
    related: [],
  };
}

/**
 * Generate gradient CSS from palette for cinematic hero
 */
export function generatePaletteGradient(palette?: { primary: string; secondary: string; accent: string }): string {
  if (!palette) {
    return 'bg-gradient-to-b from-stone-50 via-stone-100 to-stone-200';
  }

  // Create a tailwind-compatible gradient using inline styles
  return `linear-gradient(to bottom, ${palette.primary}20, transparent, ${palette.secondary}10)`;
}

