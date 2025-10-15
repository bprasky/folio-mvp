export type Slot = { 
  key: string; 
  label: string; 
  category: string; 
  defaultSize: 'large' | 'medium' | 'small' 
};

export type RoomTemplate = { 
  type: 'KITCHEN' | 'BATH' | 'LIVING' | 'BEDROOM' | 'DINING' | 'OFFICE' | 'ENTRY'; 
  slots: Slot[] 
};

export const ROOM_TEMPLATES: Record<RoomTemplate['type'], RoomTemplate> = {
  KITCHEN: {
    type: 'KITCHEN',
    slots: [
      { key: 'countertop', label: 'Countertop', category: 'countertops', defaultSize: 'large' },
      { key: 'backsplash', label: 'Backsplash', category: 'tile-backsplash', defaultSize: 'medium' },
      { key: 'sink', label: 'Sink', category: 'sinks', defaultSize: 'small' },
      { key: 'faucet', label: 'Faucet', category: 'faucets', defaultSize: 'small' },
      { key: 'appliances', label: 'Appliances', category: 'appliances', defaultSize: 'medium' },
      { key: 'lighting', label: 'Lighting', category: 'lighting', defaultSize: 'small' },
      { key: 'island', label: 'Island', category: 'cabinetry', defaultSize: 'large' },
    ],
  },
  BATH: {
    type: 'BATH',
    slots: [
      { key: 'vanity-top', label: 'Vanity Top', category: 'countertops', defaultSize: 'medium' },
      { key: 'wall-tile', label: 'Wall Tile', category: 'tile-wall', defaultSize: 'medium' },
      { key: 'floor-tile', label: 'Floor Tile', category: 'tile-floor', defaultSize: 'medium' },
      { key: 'sink', label: 'Sink', category: 'sinks', defaultSize: 'small' },
      { key: 'faucet', label: 'Faucet', category: 'faucets', defaultSize: 'small' },
      { key: 'shower-system', label: 'Shower System', category: 'shower-systems', defaultSize: 'medium' },
      { key: 'lighting', label: 'Lighting', category: 'lighting', defaultSize: 'small' },
    ],
  },
  LIVING: {
    type: 'LIVING',
    slots: [
      { key: 'sofa', label: 'Sofa', category: 'sofas', defaultSize: 'large' },
      { key: 'rug', label: 'Rug', category: 'rugs', defaultSize: 'medium' },
      { key: 'coffee-table', label: 'Coffee Table', category: 'tables-coffee', defaultSize: 'medium' },
      { key: 'lighting', label: 'Lighting', category: 'lighting', defaultSize: 'small' },
      { key: 'art', label: 'Art', category: 'art', defaultSize: 'small' },
      { key: 'accent-chairs', label: 'Accent Chairs', category: 'chairs', defaultSize: 'medium' },
      { key: 'storage', label: 'Storage', category: 'storage', defaultSize: 'small' },
    ],
  },
  BEDROOM: {
    type: 'BEDROOM',
    slots: [
      { key: 'bed', label: 'Bed', category: 'beds', defaultSize: 'large' },
      { key: 'nightstands', label: 'Nightstands', category: 'nightstands', defaultSize: 'small' },
      { key: 'dresser', label: 'Dresser', category: 'storage', defaultSize: 'medium' },
      { key: 'rug', label: 'Rug', category: 'rugs', defaultSize: 'medium' },
      { key: 'lighting', label: 'Lighting', category: 'lighting', defaultSize: 'small' },
      { key: 'art', label: 'Art', category: 'art', defaultSize: 'small' },
    ],
  },
  DINING: {
    type: 'DINING',
    slots: [
      { key: 'table', label: 'Dining Table', category: 'tables-dining', defaultSize: 'large' },
      { key: 'chairs', label: 'Chairs', category: 'chairs-dining', defaultSize: 'medium' },
      { key: 'lighting', label: 'Lighting', category: 'lighting', defaultSize: 'small' },
      { key: 'rug', label: 'Rug', category: 'rugs', defaultSize: 'medium' },
      { key: 'storage', label: 'Storage', category: 'storage', defaultSize: 'small' },
    ],
  },
  OFFICE: {
    type: 'OFFICE',
    slots: [
      { key: 'desk', label: 'Desk', category: 'desks', defaultSize: 'large' },
      { key: 'chair', label: 'Chair', category: 'chairs-office', defaultSize: 'medium' },
      { key: 'storage', label: 'Storage', category: 'storage', defaultSize: 'small' },
      { key: 'lighting', label: 'Lighting', category: 'lighting', defaultSize: 'small' },
      { key: 'rug', label: 'Rug', category: 'rugs', defaultSize: 'medium' },
    ],
  },
  ENTRY: {
    type: 'ENTRY',
    slots: [
      { key: 'console', label: 'Console', category: 'tables-console', defaultSize: 'medium' },
      { key: 'mirror', label: 'Mirror', category: 'mirrors', defaultSize: 'small' },
      { key: 'rug', label: 'Rug', category: 'rugs', defaultSize: 'medium' },
      { key: 'lighting', label: 'Lighting', category: 'lighting', defaultSize: 'small' },
      { key: 'storage', label: 'Storage', category: 'storage', defaultSize: 'small' },
    ],
  },
};

// Helper function to get room template by name (fallback for existing rooms)
export function getRoomTemplate(roomName: string): RoomTemplate | null {
  const name = roomName.toLowerCase();
  
  if (name.includes('kitchen')) return ROOM_TEMPLATES.KITCHEN;
  if (name.includes('bath')) return ROOM_TEMPLATES.BATH;
  if (name.includes('living')) return ROOM_TEMPLATES.LIVING;
  if (name.includes('bedroom') || name.includes('master')) return ROOM_TEMPLATES.BEDROOM;
  if (name.includes('dining')) return ROOM_TEMPLATES.DINING;
  if (name.includes('office')) return ROOM_TEMPLATES.OFFICE;
  if (name.includes('entry') || name.includes('foyer')) return ROOM_TEMPLATES.ENTRY;
  
  return null;
}

// Helper function to get room template by type
export function getRoomTemplateByType(type: string): RoomTemplate | null {
  return ROOM_TEMPLATES[type as RoomTemplate['type']] || null;
}

// Category to slotKey mapping for auto-assignment
export const CATEGORY_TO_SLOTKEY: Record<string, string> = {
  // Kitchen
  countertops: 'countertop',
  'tile-backsplash': 'backsplash',
  sinks: 'sink',
  faucets: 'faucet',
  appliances: 'appliances',
  lighting: 'lighting',
  cabinetry: 'island',
  
  // Living room
  sofas: 'sofa',
  rugs: 'rug',
  'tables-coffee': 'coffee-table',
  art: 'art',
  chairs: 'accent-chairs',
  storage: 'storage',
  
  // Bedroom
  beds: 'bed',
  nightstands: 'nightstands',
  dressers: 'dresser',
  
  // Bathroom
  'tile-wall': 'wall-tile',
  'tile-floor': 'floor-tile',
  'shower-systems': 'shower-system',
  
  // Dining
  'tables-dining': 'table',
  'chairs-dining': 'chairs',
  
  // Office
  desks: 'desk',
  'chairs-office': 'chair',
  
  // Entry
  'tables-console': 'console',
  mirrors: 'mirror',
  
  // General
  'tile': 'floor-tile', // fallback for tile products
  'table': 'coffee-table', // fallback for tables
  'chair': 'accent-chairs', // fallback for chairs
};

// Helper functions for category normalization and slotKey inference
function normalizeCategory(s?: string) {
  return (s || '').trim().toLowerCase();
}

export function inferSlotKeyFromCategory(cat?: string) {
  return CATEGORY_TO_SLOTKEY[normalizeCategory(cat)] || null;
}

// Helper function to infer slotKey from selection data
export function inferSlotKey(selection: any, roomTemplate: RoomTemplate | null): string | null {
  if (!roomTemplate) return null;
  
  // Try to match by tags first
  const tags = (selection.tags || []).join(' ').toLowerCase();
  for (const [category, slotKey] of Object.entries(CATEGORY_TO_SLOTKEY)) {
    if (tags.includes(category)) {
      // Check if this slot exists in the room template
      if (roomTemplate.slots.some(slot => slot.key === slotKey)) {
        return slotKey;
      }
    }
  }
  
  // Try to match by product name
  const name = (selection.productName || '').toLowerCase();
  for (const [category, slotKey] of Object.entries(CATEGORY_TO_SLOTKEY)) {
    if (name.includes(category)) {
      if (roomTemplate.slots.some(slot => slot.key === slotKey)) {
        return slotKey;
      }
    }
  }
  
  return null;
}