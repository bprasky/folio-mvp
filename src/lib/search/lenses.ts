export interface Lens {
  id: string;
  label: string;
  type: 'style' | 'space' | 'material' | 'status' | 'custom';
  scope: 'public' | 'private' | 'both';
  weights: {
    tagBoost?: string[];      // Tags to boost
    tagSuppress?: string[];   // Tags to de-prioritize
    spaceFilter?: string[];   // Limit to space types
    materialFilter?: string[]; // Limit to materials
    styleVector?: number[];   // Embedding for style similarity
  };
}

// GRANULAR LENSES - Available in both public and private search
export const GRANULAR_LENSES: Lens[] = [
  // By Room
  {
    id: 'room-kitchen',
    label: 'Kitchen',
    type: 'space',
    scope: 'both',
    weights: { spaceFilter: ['kitchen'] },
  },
  {
    id: 'room-bathroom',
    label: 'Bathroom',
    type: 'space',
    scope: 'both',
    weights: { spaceFilter: ['bathroom', 'powder room', 'ensuite'] },
  },
  {
    id: 'room-living',
    label: 'Living',
    type: 'space',
    scope: 'both',
    weights: { spaceFilter: ['living room', 'family room', 'great room'] },
  },
  {
    id: 'room-bedroom',
    label: 'Bedroom',
    type: 'space',
    scope: 'both',
    weights: { spaceFilter: ['bedroom', 'master bedroom', 'guest room'] },
  },
  {
    id: 'room-outdoor',
    label: 'Outdoor',
    type: 'space',
    scope: 'both',
    weights: { spaceFilter: ['pool', 'patio', 'terrace', 'garden', 'outdoor'] },
  },
  // By Material
  {
    id: 'material-marble',
    label: 'Marble',
    type: 'material',
    scope: 'both',
    weights: { materialFilter: ['marble', 'calacatta', 'carrara', 'statuario'] },
  },
  {
    id: 'material-brass',
    label: 'Brass',
    type: 'material',
    scope: 'both',
    weights: { materialFilter: ['brass', 'unlacquered brass', 'antique brass'] },
  },
  {
    id: 'material-wood',
    label: 'Wood',
    type: 'material',
    scope: 'both',
    weights: { materialFilter: ['wood', 'oak', 'walnut', 'teak', 'timber'] },
  },
  {
    id: 'material-stone',
    label: 'Stone',
    type: 'material',
    scope: 'both',
    weights: { materialFilter: ['stone', 'limestone', 'travertine', 'granite', 'quartzite'] },
  },
  {
    id: 'material-terrazzo',
    label: 'Terrazzo',
    type: 'material',
    scope: 'both',
    weights: { materialFilter: ['terrazzo'] },
  },
  // By Space Type
  {
    id: 'type-residential',
    label: 'Residential',
    type: 'space',
    scope: 'both',
    weights: { tagBoost: ['residential', 'home', 'house', 'apartment'] },
  },
  {
    id: 'type-hospitality',
    label: 'Hospitality',
    type: 'space',
    scope: 'both',
    weights: { tagBoost: ['hotel', 'resort', 'hospitality', 'restaurant', 'bar'] },
  },
  {
    id: 'type-commercial',
    label: 'Commercial',
    type: 'space',
    scope: 'both',
    weights: { tagBoost: ['commercial', 'office', 'retail', 'workspace'] },
  },
];

// EDITORIAL LENSES - Style-based, available in both public and private
export const EDITORIAL_LENSES: Lens[] = [
  {
    id: 'style-mediterranean',
    label: 'Mediterranean',
    type: 'style',
    scope: 'both',
    weights: {
      tagBoost: ['terracotta', 'olive', 'stone', 'arch', 'plaster', 'courtyard'],
      // styleVector would be populated with actual embedding in production
    },
  },
  {
    id: 'style-coastal-minimal',
    label: 'Coastal Minimal',
    type: 'style',
    scope: 'both',
    weights: {
      tagBoost: ['white', 'natural', 'linen', 'light', 'ocean', 'coastal'],
      tagSuppress: ['ornate', 'traditional', 'dark'],
    },
  },
  {
    id: 'style-hotel-inspired',
    label: 'Hotel-Inspired',
    type: 'style',
    scope: 'both',
    weights: {
      tagBoost: ['boutique', 'luxury', 'lobby', 'suite', 'hospitality'],
    },
  },
  {
    id: 'style-stone-forward',
    label: 'Stone-Forward',
    type: 'style',
    scope: 'both',
    weights: {
      tagBoost: ['stone', 'marble', 'travertine', 'limestone', 'slab'],
    },
  },
];

// PRIVATE-ONLY LENSES - Only make sense for designer's own work
export const PRIVATE_ONLY_LENSES: Lens[] = [
  {
    id: 'status-published',
    label: 'Published Only',
    type: 'status',
    scope: 'private',
    weights: {
      // Filter implementation handles this
    },
  },
  {
    id: 'status-unpublished',
    label: 'Unpublished Only',
    type: 'status',
    scope: 'private',
    weights: {
      // Filter implementation handles this
    },
  },
  {
    id: 'by-my-projects',
    label: 'By Project',
    type: 'custom',
    scope: 'private',
    // Dynamic: populated with designer's actual project names
    weights: {},
  },
];

/**
 * Get lenses for a given scope
 */
export function getLensesForScope(scope: 'public' | 'private'): Lens[] {
  const base = [...GRANULAR_LENSES, ...EDITORIAL_LENSES];
  if (scope === 'private') {
    return [...base, ...PRIVATE_ONLY_LENSES];
  }
  return base;
}

/**
 * Get a specific lens by ID
 */
export function getLensById(lensId: string): Lens | undefined {
  const allLenses = [...GRANULAR_LENSES, ...EDITORIAL_LENSES, ...PRIVATE_ONLY_LENSES];
  return allLenses.find(lens => lens.id === lensId);
}

/**
 * Group lenses by type for UI display
 */
export function groupLensesByType(lenses: Lens[]): {
  rooms: Lens[];
  materials: Lens[];
  styles: Lens[];
  status: Lens[];
  custom: Lens[];
} {
  return {
    rooms: lenses.filter(l => l.type === 'space' && l.id.startsWith('room-')),
    materials: lenses.filter(l => l.type === 'material'),
    styles: lenses.filter(l => l.type === 'style'),
    status: lenses.filter(l => l.type === 'status'),
    custom: lenses.filter(l => l.type === 'custom'),
  };
}

