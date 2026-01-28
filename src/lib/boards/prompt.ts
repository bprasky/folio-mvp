import { prisma } from '@/lib/prisma';
import type { RenderSettings } from '@/lib/ai/imageGen';

// ============ RENDER SETTINGS MAPS ============

const TIME_OF_DAY_DESCRIPTIONS: Record<string, string> = {
  golden_hour_morning: 'soft warm morning light streaming through windows, golden hour quality, east-facing light',
  midday: 'bright natural daylight flooding the space, soft diffused shadows, high key lighting',
  golden_hour_evening: 'warm evening golden hour light, long soft shadows, west-facing amber glow',
  twilight: 'blue hour ambient light mixing with warm interior lighting, dusk visible through windows',
  night: 'evening interior lighting, cozy warm artificial light sources, city lights or darkness through windows',
};

const LIGHTING_MOOD_DESCRIPTIONS: Record<string, string> = {
  bright_airy: 'bright, airy atmosphere with abundant natural light, optimistic feel',
  moody_dramatic: 'dramatic lighting with intentional shadows and contrast, editorial mood',
  warm_cozy: 'warm, inviting atmosphere with soft diffused light, intimate and comfortable',
  cool_minimal: 'cool-toned minimal lighting, clean architectural shadows, contemporary feel',
};

const CAMERA_DESCRIPTIONS: Record<string, string> = {
  eye_level: 'camera at human eye level (5 feet), natural perspective',
  elevated: 'slightly elevated camera angle showing floor plane, architectural overview',
  low_angle: 'low camera angle emphasizing ceiling height and furniture presence',
};

// ============ DIMENSION FORMATTER ============

type Dim = { widthIn?: number; depthIn?: number; heightIn?: number };

function fmtDims(uiMeta: unknown): string {
  if (!uiMeta || typeof uiMeta !== 'object') return '';
  const dims = (uiMeta as Record<string, unknown>).dimensions;
  if (!dims || typeof dims !== 'object') return '';

  const d = dims as Dim;
  const parts: string[] = [];
  if (d.widthIn) parts.push(`${d.widthIn}"`);
  if (d.depthIn) parts.push(`${d.depthIn}"`);
  if (d.heightIn) parts.push(`${d.heightIn}"`);

  return parts.length ? ` (${parts.join(' × ')})` : '';
}

function canon(str?: string | null) {
  return (str ?? '').trim().toLowerCase();
}

function uniqWords(input: string): string {
  const seen = new Set<string>();
  return input
    .split(/[,\s]+/)
    .map((w) => w.trim())
    .filter((w) => {
      if (!w) return false;
      const key = w.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .join(' ');
}

// ============ PRODUCT CATEGORY GROUPING ============

const CATEGORY_MAP: Record<string, string> = {
  // Seating
  sofa: 'Seating', couch: 'Seating', chair: 'Seating', armchair: 'Seating',
  sectional: 'Seating', bench: 'Seating', stool: 'Seating', ottoman: 'Seating',

  // Tables & Storage
  table: 'Tables & Storage', desk: 'Tables & Storage', console: 'Tables & Storage',
  sideboard: 'Tables & Storage', cabinet: 'Tables & Storage', dresser: 'Tables & Storage',
  nightstand: 'Tables & Storage', bookshelf: 'Tables & Storage', shelving: 'Tables & Storage',
  'coffee table': 'Tables & Storage', 'side table': 'Tables & Storage', 'dining table': 'Tables & Storage',

  // Beds
  bed: 'Beds', headboard: 'Beds',

  // Lighting
  pendant: 'Lighting', chandelier: 'Lighting', sconce: 'Lighting', lamp: 'Lighting',
  'floor lamp': 'Lighting', 'table lamp': 'Lighting', 'ceiling light': 'Lighting',

  // Textiles
  rug: 'Textiles', curtain: 'Textiles', drape: 'Textiles', pillow: 'Textiles',
  throw: 'Textiles', bedding: 'Textiles', upholstery: 'Textiles',

  // Surfaces & Materials
  paint: 'Surfaces & Finishes', tile: 'Surfaces & Finishes', stone: 'Surfaces & Finishes',
  marble: 'Surfaces & Finishes', granite: 'Surfaces & Finishes', quartz: 'Surfaces & Finishes',
  wood: 'Surfaces & Finishes', flooring: 'Surfaces & Finishes', wallpaper: 'Surfaces & Finishes',
  backsplash: 'Surfaces & Finishes', countertop: 'Surfaces & Finishes',

  // Hardware & Fixtures
  handle: 'Hardware & Fixtures', knob: 'Hardware & Fixtures', pull: 'Hardware & Fixtures',
  faucet: 'Hardware & Fixtures', hardware: 'Hardware & Fixtures', fixture: 'Hardware & Fixtures',
  sink: 'Hardware & Fixtures', toilet: 'Hardware & Fixtures', tub: 'Hardware & Fixtures',

  // Decor
  art: 'Decor & Accessories', mirror: 'Decor & Accessories', vase: 'Decor & Accessories',
  plant: 'Decor & Accessories', sculpture: 'Decor & Accessories', object: 'Decor & Accessories',
  accessory: 'Decor & Accessories', decor: 'Decor & Accessories',
};

function categorizeProduct(slotKey: string | null): string {
  if (!slotKey) return 'Other';
  const key = slotKey.toLowerCase().trim();

  // Check exact match first
  if (CATEGORY_MAP[key]) return CATEGORY_MAP[key];

  // Check if key contains any category keyword
  for (const [keyword, category] of Object.entries(CATEGORY_MAP)) {
    if (key.includes(keyword)) return category;
  }

  return 'Other';
}

// ============ TYPES ============

export interface BuildPromptParams {
  projectId: string;
  roomId: string;
  settings?: RenderSettings;
}

export interface PromptResult {
  base: string;
  context: {
    roomId: string;
    roomName: string | null;
    roomType: string | null;
    selections: Array<{
      id: string;
      role: string;
      category: string;
      line: string;
      imageUrl: string;
      styleTags: string[];
      quantity: number;
    }>;
    settings: RenderSettings;
  };
  selectionIds: string[];
}

const DEFAULT_SETTINGS: RenderSettings = {
  timeOfDay: 'midday',
  lightingMood: 'bright_airy',
  cameraAngle: 'eye_level',
};

// ============ MAIN PROMPT BUILDER ============

export async function buildBasePrompt(params: BuildPromptParams): Promise<PromptResult> {
  const { projectId, roomId, settings = DEFAULT_SETTINGS } = params;

  // Fetch room
  const room = await prisma.room.findUnique({
    where: { id: roomId },
    select: { id: true, name: true, type: true },
  });

  // Fetch selections with ALL available fields including linked ProductTag -> Product
  const selections = await prisma.selection.findMany({
    where: { projectId, roomId },
    orderBy: [{ slotKey: 'asc' }, { createdAt: 'asc' }],
    select: {
      id: true,
      slotKey: true,
      productName: true,
      vendorName: true,
      colorFinish: true,
      photo: true,
      tags: true,
      uiMeta: true,
      notes: true,
      quantity: true,
      // Get linked Product data through ProductTag if available
      productTag: {
        select: {
          product: {
            select: {
              description: true,
              category: true,
              cutoutImageUrl: true,
              brand: true,
            },
          },
        },
      },
    },
  });

  // Build product lines grouped by category
  const groupedProducts: Record<string, string[]> = {};
  const contextSelections: PromptResult['context']['selections'] = [];
  const allTags: string[] = [];

  for (const sel of selections) {
    const role = canon(sel.slotKey) || 'item';
    const category = categorizeProduct(sel.slotKey);
    const vendor = sel.vendorName || sel.productTag?.product?.brand || '';
    const name = sel.productName || 'Unknown';
    const finish = sel.colorFinish || '';
    const dims = fmtDims(sel.uiMeta);
    const qty = sel.quantity || 1;

    // Build detailed product line
    const parts: string[] = [];
    parts.push(role);
    if (vendor) parts.push(`by ${vendor}`);
    parts.push(`"${name}"`);
    if (finish) parts.push(`in ${finish}`);
    if (dims) parts.push(dims);
    if (qty > 1) parts.push(`(quantity: ${qty})`);

    // Add designer notes if they provide useful context (keep short)
    if (sel.notes && sel.notes.length > 0 && sel.notes.length < 100) {
      parts.push(`[note: ${sel.notes}]`);
    }

    const line = parts.join(' ');

    // Group by category
    if (!groupedProducts[category]) groupedProducts[category] = [];
    groupedProducts[category].push(`- ${line}`);

    // Collect tags
    allTags.push(...sel.tags);

    // Prefer cutout image over regular photo for cleaner references
    const imageUrl = sel.productTag?.product?.cutoutImageUrl || sel.photo || '';

    // Build context
    contextSelections.push({
      id: sel.id,
      role,
      category,
      line,
      imageUrl,
      styleTags: sel.tags,
      quantity: qty,
    });
  }

  // Derive style tags (max 8, deduplicated)
  const uniqueTags = [...new Set(allTags)].slice(0, 8);
  const stylePhrase = uniqueTags.length > 0 ? uniqueTags.join(', ') : 'contemporary interior';

  // Build the prompt sections
  const sections: string[] = [];

  // 1. Scene description
  const roomName = room?.name || 'interior space';
  const roomType = room?.type || '';
  sections.push(`Create a photorealistic editorial interior render of a ${roomType} ${roomName}.`.trim().replace(/\s+/g, ' '));

  // 2. Style & atmosphere
  sections.push(`Style keywords: ${stylePhrase}.`);

  // 3. Lighting (from settings)
  const timeDesc = TIME_OF_DAY_DESCRIPTIONS[settings.timeOfDay] || TIME_OF_DAY_DESCRIPTIONS.midday;
  const moodDesc = LIGHTING_MOOD_DESCRIPTIONS[settings.lightingMood] || LIGHTING_MOOD_DESCRIPTIONS.bright_airy;
  sections.push(`Lighting: ${timeDesc}. ${moodDesc}.`);

  // 4. Camera (from settings)
  const camDesc = CAMERA_DESCRIPTIONS[settings.cameraAngle] || CAMERA_DESCRIPTIONS.eye_level;
  sections.push(`Camera: ${camDesc}, architectural photography composition.`);

  // 5. Products by category (the core content)
  sections.push('\nFEATURED PRODUCTS (render these exact items with faithful geometry, materials, and finishes):');

  const categoryOrder = [
    'Seating', 'Beds', 'Tables & Storage', 'Lighting',
    'Surfaces & Finishes', 'Hardware & Fixtures', 'Textiles', 'Decor & Accessories', 'Other'
  ];

  for (const cat of categoryOrder) {
    if (groupedProducts[cat] && groupedProducts[cat].length > 0) {
      sections.push(`\n[${cat}]`);
      sections.push(groupedProducts[cat].join('\n'));
    }
  }

  // 6. Reference images (prefer cutouts over photos)
  const refs = contextSelections
    .filter((s) => s.imageUrl)
    .map((s) => `Reference for ${s.role}: ${s.imageUrl}`);

  if (refs.length > 0) {
    sections.push('\nREFERENCE IMAGES:');
    sections.push(refs.join('\n'));
  }

  // 7. Constraints
  sections.push(`
CONSTRAINTS:
- Preserve exact product proportions, materials, and finishes from references
- Do not substitute with lookalike items
- Keep composition clean and editorial; minimal styling props only if needed
- No text, logos, or watermarks unless present in references
- If an attribute is missing, choose the closest plausible option
- Photorealistic quality: 8K, ray-traced lighting, depth of field`);

  const base = sections.join('\n');

  return {
    base,
    context: {
      roomId,
      roomName: room?.name ?? null,
      roomType: room?.type ?? null,
      selections: contextSelections,
      settings,
    },
    selectionIds: selections.map((s) => s.id),
  };
}

// ============ MERGE MODIFIERS ============

export function mergeModifiers(base: string, modifiers: string): string {
  const trimmed = modifiers?.trim();
  if (!trimmed) return base;
  return `${base}\n\nADDITIONAL ART DIRECTION:\n${uniqWords(trimmed)}`;
}
