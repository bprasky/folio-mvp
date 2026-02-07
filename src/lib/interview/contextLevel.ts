/**
 * Context Level Assessment for Interview Questions
 *
 * Interview questions scale with available context. The more we know about the project,
 * the smarter and more specific our questions become.
 *
 * Levels:
 * 0 - Nothing (generic fallback)
 * 1 - Final photos only (room-based, visual observations)
 * 2 - + Material schedule (product-specific, vendor loyalty)
 * 3 - + Concept presentation (vision realization, aesthetic choices)
 * 4 - + Floor plan (spatial flow, transitions, reveals)
 * 5 - + Progress presentations (decision journey, "landing on" narratives)
 */

import { prisma } from '@/lib/prisma';

// Types for context assessment
export type ContextLevel = 0 | 1 | 2 | 3 | 4 | 5;

export type RoomType =
  | 'KITCHEN'
  | 'BATH'
  | 'PRIMARY_BEDROOM'
  | 'BEDROOM'
  | 'LIVING'
  | 'DINING'
  | 'OFFICE'
  | 'ENTRY'
  | 'OUTDOOR'
  | 'OTHER';

export interface RoomContext {
  id: string;
  name: string;
  type: RoomType | null;
  selectionCount: number;
  dominantVendor?: string;
  keyPieces: SelectionContext[];
  adjacentRooms: string[];
  transitionType?: 'flows_into' | 'opens_to' | 'reveals' | 'connects';
}

export interface SelectionContext {
  id: string;
  productName: string;
  brand: string;
  room: string;
  roomId?: string;
  isHeroPiece: boolean;
  decisionJourney?: 'direct' | 'evolved' | 'fought_for';
  vendorLoyalty?: boolean;
}

export interface VendorInsight {
  name: string;
  selectionCount: number;
  rooms: string[];
  totalValue?: number;
}

export interface DecisionEvent {
  productName: string;
  productId?: string;
  brand: string;
  room: string;
  event: 'selected' | 'promoted' | 'evolved';
  iterationCount?: number;
  finalSelection: boolean;
}

export interface SpatialRelationship {
  fromRoom: string;
  toRoom: string;
  relationship: 'flows_into' | 'opens_to' | 'grand_reveal' | 'intimate_transition' | 'adjacent';
  description?: string;
}

export interface AspirationalItem {
  productName: string;
  brand: string;
  room?: string;
  source: 'concept_presentation';
}

export interface AmbiencePattern {
  description: string;
  confidence: number;
  source: 'ai_classification' | 'concept_presentation';
}

export interface ProjectContext {
  level: ContextLevel;

  // What's available
  hasPhotos: boolean;
  hasGeneratedImages: boolean;
  isProspective: boolean;
  hasMaterialSchedule: boolean;
  hasConceptPresentation: boolean;
  hasFloorPlan: boolean;
  hasProgressPresentations: boolean;

  // Extracted data
  rooms: RoomContext[];
  selections: SelectionContext[];
  aspirationalItems: AspirationalItem[];
  ambiencePatterns: AmbiencePattern[];
  decisionTrail: DecisionEvent[];
  spatialFlow: SpatialRelationship[];

  // Computed insights
  dominantVendors: VendorInsight[];
  materialThemes: string[];
  colorPalette: string[];
  designNarrative: string;

  // Raw data for question generation
  projectTitle?: string;
  projectDescription?: string;
}

/**
 * Compute which vendors appear most frequently across selections
 */
function computeDominantVendors(selections: SelectionContext[]): VendorInsight[] {
  const vendorMap = new Map<string, { count: number; rooms: Set<string> }>();

  for (const selection of selections) {
    if (!selection.brand) continue;

    const existing = vendorMap.get(selection.brand) || { count: 0, rooms: new Set<string>() };
    existing.count++;
    if (selection.room) {
      existing.rooms.add(selection.room);
    }
    vendorMap.set(selection.brand, existing);
  }

  return Array.from(vendorMap.entries())
    .map(([name, data]) => ({
      name,
      selectionCount: data.count,
      rooms: Array.from(data.rooms),
    }))
    .sort((a, b) => b.selectionCount - a.selectionCount);
}

/**
 * Identify material themes from selections and AI classification
 */
function computeMaterialThemes(
  selections: SelectionContext[],
  aiMaterials: string[]
): string[] {
  const themes = new Set<string>();

  // Map common materials to theme names
  const materialToTheme: Record<string, string> = {
    marble: 'natural_stone',
    granite: 'natural_stone',
    quartzite: 'natural_stone',
    limestone: 'natural_stone',
    travertine: 'natural_stone',
    brass: 'brass_hardware',
    bronze: 'brass_hardware',
    gold: 'brass_hardware',
    oak: 'warm_wood',
    walnut: 'warm_wood',
    teak: 'warm_wood',
    linen: 'natural_textiles',
    cotton: 'natural_textiles',
    wool: 'natural_textiles',
    velvet: 'luxe_textiles',
    silk: 'luxe_textiles',
    steel: 'modern_metal',
    chrome: 'modern_metal',
    nickel: 'modern_metal',
    concrete: 'industrial',
    glass: 'modern_transparency',
  };

  // Check AI-detected materials
  for (const material of aiMaterials) {
    const lower = material.toLowerCase();
    for (const [key, theme] of Object.entries(materialToTheme)) {
      if (lower.includes(key)) {
        themes.add(theme);
      }
    }
  }

  // Check selections for material hints in product names
  for (const selection of selections) {
    const productNameLower = selection.productName?.toLowerCase() || '';
    for (const [key, theme] of Object.entries(materialToTheme)) {
      if (productNameLower.includes(key)) {
        themes.add(theme);
      }
    }
  }

  return Array.from(themes);
}

/**
 * Extract color palette from AI classifications
 */
function extractColorPalette(
  aiClassifications: Array<{ colors?: string[]; mood?: string[] }>
): string[] {
  const colorMap = new Map<string, number>();

  for (const classification of aiClassifications) {
    if (classification.colors) {
      for (const color of classification.colors) {
        colorMap.set(color, (colorMap.get(color) || 0) + 1);
      }
    }
  }

  // Also check mood for color descriptors
  const moodToColor: Record<string, string> = {
    warm: 'warm_neutrals',
    cozy: 'warm_neutrals',
    bright: 'light_and_airy',
    airy: 'light_and_airy',
    moody: 'dark_dramatic',
    dramatic: 'dark_dramatic',
    earthy: 'earth_tones',
    natural: 'earth_tones',
  };

  for (const classification of aiClassifications) {
    if (classification.mood) {
      for (const mood of classification.mood) {
        const moodLower = mood.toLowerCase();
        for (const [key, palette] of Object.entries(moodToColor)) {
          if (moodLower.includes(key)) {
            colorMap.set(palette, (colorMap.get(palette) || 0) + 1);
          }
        }
      }
    }
  }

  return Array.from(colorMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([color]) => color);
}

/**
 * Normalize room type string to RoomType enum
 */
function normalizeRoomType(type: string | null | undefined): RoomType | null {
  if (!type) return null;

  const normalized = type.toUpperCase().replace(/[^A-Z_]/g, '');
  const validTypes: RoomType[] = [
    'KITCHEN',
    'BATH',
    'PRIMARY_BEDROOM',
    'BEDROOM',
    'LIVING',
    'DINING',
    'OFFICE',
    'ENTRY',
    'OUTDOOR',
    'OTHER',
  ];

  // Handle common variations
  if (normalized.includes('KITCHEN')) return 'KITCHEN';
  if (normalized.includes('BATH') || normalized.includes('BATHROOM')) return 'BATH';
  if (normalized.includes('PRIMARY') || normalized.includes('MASTER')) return 'PRIMARY_BEDROOM';
  if (normalized.includes('BED')) return 'BEDROOM';
  if (normalized.includes('LIVING') || normalized.includes('FAMILY')) return 'LIVING';
  if (normalized.includes('DINING')) return 'DINING';
  if (normalized.includes('OFFICE') || normalized.includes('STUDY')) return 'OFFICE';
  if (normalized.includes('ENTRY') || normalized.includes('FOYER')) return 'ENTRY';
  if (normalized.includes('OUTDOOR') || normalized.includes('PATIO')) return 'OUTDOOR';

  return validTypes.includes(normalized as RoomType) ? (normalized as RoomType) : 'OTHER';
}

/**
 * Main function to assess project context and determine the context level
 */
export async function assessProjectContext(projectId: string): Promise<ProjectContext> {
  // Fetch project with all relations
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      images: {
        select: {
          id: true,
          url: true,
          name: true,
          room: true,
          aiClassification: true,
          aiMaterials: true,
          aiColors: true,
          tags: {
            include: {
              product: true,
            },
          },
        },
        orderBy: { displayOrder: 'asc' },
      },
      files: {
        select: {
          id: true,
          fileName: true,
          fileType: true,
          fileUrl: true,
        },
      },
      rooms: {
        include: {
          selections: {
            select: {
              id: true,
              productName: true,
              vendorName: true,
              colorFinish: true,
              unitPrice: true,
            },
          },
        },
      },
      selections: {
        select: {
          id: true,
          productName: true,
          vendorName: true,
          colorFinish: true,
          roomId: true,
          unitPrice: true,
          room: {
            select: {
              id: true,
              name: true,
              type: true,
            },
          },
        },
      },
    },
  });

  if (!project) {
    throw new Error(`Project not found: ${projectId}`);
  }

  // Determine what data is available
  const hasPhotos = project.images.length > 0;

  // Detect generated images (metadata stored as JSON in name field)
  const generatedImageCount = project.images.filter((img) => {
    if (!img.name) return false;
    try {
      const meta = JSON.parse(img.name);
      return meta.type === 'GENERATED';
    } catch {
      return false;
    }
  }).length;
  const hasGeneratedImages = generatedImageCount > 0;

  // A project is prospective when it has generated images — the designer is
  // still in the planning/design phase, not documenting a completed project.
  const isProspective = hasGeneratedImages;

  const hasMaterialSchedule = project.files.some(
    (f) => f.fileType === 'material_schedule'
  );
  const hasConceptPresentation = project.files.some(
    (f) => f.fileType === 'concept_presentation'
  );
  const hasFloorPlan = project.files.some((f) => f.fileType === 'floor_plan');
  const hasProgressPresentations =
    project.files.filter((f) => f.fileType === 'progress_presentation').length > 0;

  // Calculate context level (sequential - each level requires previous levels)
  let level: ContextLevel = 0;
  if (hasPhotos) level = 1;
  if (level >= 1 && hasMaterialSchedule) level = 2;
  if (level >= 2 && hasConceptPresentation) level = 3;
  if (level >= 3 && hasFloorPlan) level = 4;
  if (level >= 4 && hasProgressPresentations) level = 5;

  // Extract selection context
  const selections: SelectionContext[] = project.selections
    .filter((s) => s.productName || s.vendorName)
    .map((s) => ({
      id: s.id,
      productName: s.productName || 'Unknown Product',
      brand: s.vendorName || 'Unknown Brand',
      room: s.room?.name || 'Unassigned',
      roomId: s.roomId || undefined,
      isHeroPiece: Boolean(s.unitPrice && Number(s.unitPrice) > 1000),
      vendorLoyalty: false, // Will be computed below
    }));

  // Compute vendor loyalty
  const vendorCounts = new Map<string, number>();
  for (const selection of selections) {
    vendorCounts.set(selection.brand, (vendorCounts.get(selection.brand) || 0) + 1);
  }
  for (const selection of selections) {
    selection.vendorLoyalty = (vendorCounts.get(selection.brand) || 0) >= 3;
  }

  // Compute dominant vendors
  const dominantVendors = computeDominantVendors(selections);

  // Extract AI classification data
  const aiClassifications = project.images
    .map((img) => img.aiClassification as { colors?: string[]; mood?: string[]; materials?: string[] } | null)
    .filter((c): c is NonNullable<typeof c> => c !== null);

  const allAiMaterials = project.images.flatMap((img) => img.aiMaterials || []);
  const materialThemes = computeMaterialThemes(selections, allAiMaterials);
  const colorPalette = extractColorPalette(aiClassifications);

  // Build room context
  const roomMap = new Map<string, RoomContext>();

  // First, add rooms from project.rooms
  for (const room of project.rooms) {
    const roomSelections = selections.filter((s) => s.roomId === room.id);
    const vendorCounts = new Map<string, number>();
    for (const s of roomSelections) {
      vendorCounts.set(s.brand, (vendorCounts.get(s.brand) || 0) + 1);
    }
    const dominantVendor = Array.from(vendorCounts.entries())
      .sort((a, b) => b[1] - a[1])[0]?.[0];

    roomMap.set(room.name, {
      id: room.id,
      name: room.name,
      type: normalizeRoomType(room.type),
      selectionCount: roomSelections.length,
      dominantVendor,
      keyPieces: roomSelections.filter((s) => s.isHeroPiece),
      adjacentRooms: [],
      transitionType: undefined,
    });
  }

  // Also add rooms from image room assignments
  for (const image of project.images) {
    if (image.room && !roomMap.has(image.room)) {
      const roomSelections = selections.filter((s) => s.room === image.room);
      roomMap.set(image.room, {
        id: `image-room-${image.room}`,
        name: image.room,
        type: normalizeRoomType(image.room),
        selectionCount: roomSelections.length,
        keyPieces: roomSelections.filter((s) => s.isHeroPiece),
        adjacentRooms: [],
      });
    }
  }

  const rooms = Array.from(roomMap.values());

  // Generate a simple design narrative based on available context
  let designNarrative = '';
  if (project.description) {
    designNarrative = project.description;
  } else if (rooms.length > 0) {
    const roomList = rooms.slice(0, 3).map((r) => r.name).join(', ');
    designNarrative = `A project featuring ${roomList}${rooms.length > 3 ? ' and more' : ''}.`;
  }

  return {
    level,
    hasPhotos,
    hasGeneratedImages,
    isProspective,
    hasMaterialSchedule,
    hasConceptPresentation,
    hasFloorPlan,
    hasProgressPresentations,
    rooms,
    selections,
    aspirationalItems: [], // Would require parsing concept presentations
    ambiencePatterns: aiClassifications
      .flatMap((c) => c.mood || [])
      .slice(0, 3)
      .map((mood) => ({
        description: mood,
        confidence: 0.8,
        source: 'ai_classification' as const,
      })),
    decisionTrail: [], // Would require parsing progress presentations
    spatialFlow: [], // Would require floor plan analysis
    dominantVendors,
    materialThemes,
    colorPalette,
    designNarrative,
    projectTitle: project.title,
    projectDescription: project.description || undefined,
  };
}

/**
 * Get a human-readable description of the context level
 */
export function getContextLevelDescription(level: ContextLevel): string {
  const descriptions: Record<ContextLevel, string> = {
    0: 'No project context available',
    1: 'Questions based on project photos',
    2: 'Questions personalized from your material schedule',
    3: 'Questions personalized from your presentations and schedule',
    4: 'Questions personalized from your presentations, schedule, and floor plan',
    5: 'Questions personalized from your full project journey',
  };
  return descriptions[level];
}

/**
 * Get suggestion for how to improve context level
 */
export function getContextUpgradeSuggestion(level: ContextLevel): string | null {
  const suggestions: Record<ContextLevel, string | null> = {
    0: 'Add project photos to unlock personalized questions',
    1: 'Upload a material schedule to unlock product-specific questions',
    2: 'Upload a concept presentation to unlock vision-based questions',
    3: 'Upload a floor plan to unlock spatial flow questions',
    4: 'Upload progress presentations to unlock decision journey questions',
    5: null, // Max level
  };
  return suggestions[level];
}
