import { prisma } from '@/lib/prisma';
import { analyzeImage, ImageSignals } from '@/lib/aesthetic/imageSignals';
import { extractMaterialSignals, MaterialSignals } from '@/lib/aesthetic/materialSignals';
import { extractSpatialSignals, SpatialSignals } from '@/lib/aesthetic/spatialSignals';
import { classifyImage, ImageClassification } from '@/lib/aesthetic/imageClassification';
import { hexArrayToColorNames } from './colorMapping';

/**
 * AI-detected tags from image analysis
 * Uses Claude Vision as primary, Sharp as fallback
 */
async function detectAITags(imageUrl: string, imageSignals: ImageSignals): Promise<ImageClassification> {
  try {
    // Primary: Use Claude Vision for comprehensive classification
    const classification = await classifyImage(imageUrl);
    
    // If Claude returned results, use them
    if (classification.colors.length > 0 || classification.materials.length > 0) {
      return classification;
    }
    
    // Fallback: Use Sharp for basic color extraction
    console.log('Claude Vision returned empty, falling back to Sharp');
    const fallbackColors = hexArrayToColorNames(imageSignals.dominantColors);
    
    return {
      colors: fallbackColors,
      materials: [],
      styles: [],
      mood: [],
      elements: [],
      spaces: [],
    };
  } catch (error) {
    console.error('AI tag detection failed:', error);
    
    // Final fallback: try Sharp only
    try {
      const fallbackColors = hexArrayToColorNames(imageSignals.dominantColors);
      return {
        colors: fallbackColors,
        materials: [],
        styles: [],
        mood: [],
        elements: [],
        spaces: [],
      };
    } catch {
      return { colors: [], materials: [], styles: [], mood: [], elements: [], spaces: [] };
    }
  }
}

/**
 * Calculate engagement score from views, saves, shares
 */
function calculateEngagementScore(
  views: number,
  saves: number,
  shares: number
): number {
  // Weighted scoring: saves and shares are more valuable than views
  return views * 0.1 + saves * 2.0 + shares * 3.0;
}

/**
 * Combine explicit tags (from ProductTag) with AI-detected tags
 * 
 * CRITICAL: User-classified data takes precedence
 * - Product names, categories, brands are added first (user-set)
 * - AI tags are only added as supplement, not override
 * - Spaces come from allSpaces (which respects user-set room)
 */
function combineTags(
  explicitTags: Array<{ product: { name: string; category?: string | null; brand?: string | null } }>,
  aiTags: { materials: string[]; spaces: string[]; colors: string[]; objects: string[] }
): string[] {
  const combined = new Set<string>();
  
  // PRIORITY 1: Add explicit product names, categories, brands (user-classified)
  // These are the ultimate truth - user explicitly tagged these products
  for (const tag of explicitTags) {
    if (tag.product.name) {
      combined.add(tag.product.name.toLowerCase());
    }
    if (tag.product.category) {
      // User-set category is ultimate truth - don't let AI override
      combined.add(tag.product.category.toLowerCase());
    }
    if (tag.product.brand) {
      combined.add(tag.product.brand.toLowerCase());
    }
  }
  
  // PRIORITY 2: Add AI-detected tags as supplement (only if not conflicting)
  // Spaces: Already filtered to only user-set room (via allSpaces)
  aiTags.spaces.forEach(s => combined.add(s.toLowerCase()));
  
  // Materials, colors, objects: Add AI-detected (no user-set versions in schema)
  // Note: extractAttributes already prioritizes product context for materials
  aiTags.materials.forEach(m => combined.add(m.toLowerCase()));
  aiTags.colors.forEach(c => combined.add(c.toLowerCase()));
  (aiTags.objects || []).forEach(o => combined.add(o.toLowerCase()));
  
  return Array.from(combined);
}

/**
 * Build searchable text from all available metadata
 */
function buildSearchText(
  projectTitle: string,
  projectDescription: string | null,
  designerName: string,
  roomName: string | null,
  imageName: string | null,
  combinedTags: string[]
): string {
  const parts: string[] = [];
  
  parts.push(projectTitle);
  if (projectDescription) parts.push(projectDescription);
  parts.push(designerName);
  if (roomName) parts.push(roomName);
  if (imageName) parts.push(imageName);
  parts.push(...combinedTags);
  
  return parts.join(' ').toLowerCase();
}

/**
 * Normalize room name for fuzzy matching
 * "living room" → { room: "living room", roomNormalized: "livingroom" }
 */
function normalizeRoom(room: string | null | undefined): { room: string | null; roomNormalized: string | null } {
  if (!room) return { room: null, roomNormalized: null };
  
  const cleaned = room.trim().toLowerCase();
  const normalized = cleaned.replace(/[\s_-]+/g, ''); // "living room" → "livingroom"
  
  return {
    room: cleaned,
    roomNormalized: normalized,
  };
}

/**
 * Extract vendors from tagged products
 */
async function extractVendors(projectImageId: string): Promise<{ vendors: string[]; vendorIds: string[] }> {
  const tags = await prisma.productTag.findMany({
    where: { imageId: projectImageId },
    include: {
      product: {
        include: {
          vendor: { 
            select: { 
              id: true, 
              name: true, 
              companyName: true 
            } 
          },
        },
      },
    },
  });
  
  const vendorMap = new Map<string, string>();
  for (const tag of tags) {
    const vendor = tag.product?.vendor;
    if (vendor) {
      const name = vendor.companyName || vendor.name || '';
      if (name && vendor.id) {
        vendorMap.set(vendor.id, name.toLowerCase());
      }
    }
  }
  
  return {
    vendorIds: Array.from(vendorMap.keys()),
    vendors: Array.from(vendorMap.values()),
  };
}

/**
 * Extract attributes (colors, materials, categories, styles, mood, elements) from AI tags and product data
 * 
 * CRITICAL: AI-detected attributes are PRIMARY source (colors, materials, styles, mood, elements are NOT user-set)
 * - Categories: ONLY from product.category (user-set), never from AI
 * - Colors: AI-detected PRIMARY, product names as supplement
 * - Materials: AI-detected PRIMARY, product names as supplement
 * - Styles: AI-detected only (products don't contain style info)
 * - Mood: AI-detected only
 * - Elements: AI-detected only
 */
function extractAttributes(
  aiTags: ImageClassification,
  products: Array<{ name: string | null; category: string | null; brand: string | null }>
): {
  colors: string[];
  materials: string[];
  categories: string[];
  styles: string[];
  mood: string[];
  elements: string[];
} {
  const colorKeywords = [
    'white', 'black', 'gray', 'grey', 'beige', 'cream', 'ivory', 'charcoal',
    'brown', 'tan', 'oak', 'walnut', 'brass', 'gold', 'silver', 'chrome', 'copper',
    'blue', 'green', 'red', 'navy', 'terracotta', 'sage', 'pink', 'blush', 
    'yellow', 'orange', 'purple', 'teal'
  ];
  
  const materialKeywords = [
    'marble', 'granite', 'quartz', 'stone', 'concrete', 'terrazzo',
    'oak', 'walnut', 'wood', 'timber', 'teak', 'pine',
    'brass', 'bronze', 'copper', 'steel', 'iron', 'chrome', 'nickel',
    'velvet', 'linen', 'cotton', 'silk', 'wool', 'leather', 'suede',
    'glass', 'ceramic', 'porcelain', 'tile', 'brick', 'plaster'
  ];
  
  // Product text for supplementary extraction
  const productText = products.map(p => `${p.name || ''} ${p.category || ''}`).join(' ').toLowerCase();
  
  // COLORS: AI-detected colors are PRIMARY
  const aiColors = aiTags.colors || [];
  const productColors = colorKeywords.filter(kw => productText.includes(kw));
  const colors = [...new Set([...aiColors, ...productColors])];
  
  // MATERIALS: AI-detected materials are PRIMARY
  const aiMaterials = aiTags.materials || [];
  const productMaterials = materialKeywords.filter(kw => productText.includes(kw));
  const materials = [...new Set([...aiMaterials, ...productMaterials])];
  
  // STYLES: AI-detected only (products don't contain style info)
  const styles = aiTags.styles || [];
  
  // MOOD: AI-detected only
  const mood = aiTags.mood || [];
  
  // ELEMENTS: AI-detected only
  const elements = aiTags.elements || [];
  
  // CATEGORIES: From products (user-set)
  const categories = products
    .map(p => p.category?.toLowerCase())
    .filter((cat): cat is string => Boolean(cat && cat.trim()));
  
  return {
    colors: [...new Set(colors)],
    materials: [...new Set(materials)],
    categories: [...new Set(categories)],
    styles: [...new Set(styles)],
    mood: [...new Set(mood)],
    elements: [...new Set(elements)],
  };
}

/**
 * Index a single moment (ProjectImage) for search
 */
export async function indexMoment(projectImageId: string): Promise<void> {
  // 1. Fetch ProjectImage with relations
  const projectImage = await prisma.projectImage.findUnique({
    where: { id: projectImageId },
    include: {
      project: {
        include: {
          designer: {
            select: {
              id: true,
              name: true,
            },
          },
          rooms: {
            select: {
              id: true,
              name: true,
              type: true,
            },
          },
        },
      },
      tags: {
        include: {
          product: {
            select: {
              id: true,
              name: true,
              category: true,
              brand: true,
              vendor: {
                select: {
                  id: true,
                  name: true,
                  companyName: true,
                },
              },
            },
          },
        },
      },
    },
  });
  
  if (!projectImage) {
    throw new Error(`ProjectImage not found: ${projectImageId}`);
  }
  
  const { project } = projectImage;
  if (!project) {
    throw new Error(`Project not found for image: ${projectImageId}`);
  }
  
  // 2. Run AI analysis if not already done
  // Analyze image to get signals (used for AI tag detection)
  // Note: imageSignals are computed on-the-fly, not stored in the database
  const imageSignals = await analyzeImage(projectImage.url);
  
  // 3. Detect AI tags (materials, spaces, colors, objects)
  const aiTags = await detectAITags(projectImage.url, imageSignals);
  
  // Extract materials from product tags and rooms
  const materialSignals = extractMaterialSignals(
    projectImage.tags.map(t => ({ product: t.product })),
    project.rooms.map(r => ({ type: r.type || '', materials: [] }))
  );
  
  // Extract spatial signals
  const spatialSignals = extractSpatialSignals(
    project.rooms.map(r => ({ type: r.type || '', materials: [] })),
    [{ objectCount: undefined, hasArchitecturalFeatures: undefined }]
  );
  
  // Materials: Prioritize user context (product names) over AI detection
  // extractAttributes already handles this prioritization
  // materialSignals come from product tags, so they're user context
  const allMaterials = [
    ...materialSignals.dominantMaterials, // User context (from product tags)
    // Only add AI materials if no user context available
    // (extractAttributes will handle this, but we keep AI materials for combinedTags)
    ...aiTags.materials,
  ];
  
  // Extract spaces from rooms
  // CRITICAL FIX: User-submitted room is ultimate truth
  // If user set projectImage.room, ONLY use that - don't add AI-detected spaces
  // AI-detected spaces should only be used if user hasn't classified the room
  let allSpaces: string[] = [];
  
  if (projectImage.room) {
    // User has explicitly set the room - this is the ONLY source of truth
    // Don't add AI-detected spaces - user classification takes precedence
    allSpaces = [projectImage.room.toLowerCase()];
  } else {
    // No user-set room - fall back to AI detection only if user hasn't classified
    allSpaces = [
      ...aiTags.spaces,
      ...Object.keys(spatialSignals.roomTypes),
    ];
  }
  
  // 4. Combine explicit tags with AI tags
  const combinedTags = combineTags(
    projectImage.tags.map(t => ({ product: t.product })),
    {
      materials: allMaterials,
      spaces: allSpaces,
      colors: aiTags.colors,
      objects: aiTags.elements,
    }
  );
  
  // 5. Calculate engagement score
  const engagementScore = calculateEngagementScore(
    projectImage.momentViews,
    projectImage.momentSaves,
    projectImage.momentShares
  );
  
  // 6. Build search text
  const searchText = buildSearchText(
    project.title || '',
    project.description || null,
    project.designer?.name || 'Unknown',
    projectImage.room || null,
    projectImage.name || null,
    combinedTags
  );
  
  // 7. Extract new searchable fields
  const { room, roomNormalized } = normalizeRoom(projectImage.room);
  const { vendors, vendorIds } = await extractVendors(projectImageId);
  const { colors, materials, categories, styles, mood, elements } = extractAttributes(
    aiTags, // Use AI-detected classification (ImageClassification)
    projectImage.tags.map(t => ({ 
      name: t.product.name, 
      category: t.product.category, 
      brand: t.product.brand 
    }))
  );
  
  // 8. Update ProjectImage with AI-detected metadata
  await prisma.projectImage.update({
    where: { id: projectImageId },
    data: {
      aiTags: combinedTags,
      aiColors: aiTags.colors as any,
      aiMaterials: allMaterials,
      aiSpaces: allSpaces,
      indexedAt: new Date(),
      // Store full classification for interview questions
      aiClassification: aiTags as any,
      aiClassifiedAt: new Date(),
    },
  });
  
  // 9. Upsert MomentIndex record with new fields
  await prisma.momentIndex.upsert({
    where: { projectImageId },
    create: {
      projectImageId,
      projectId: project.id,
      designerId: project.designerId || project.ownerId,
      designerName: project.designer?.name || 'Unknown',
      projectTitle: project.title || '',
      isPublic: project.isPublic,
      publishedAt: project.publishedAt,
      combinedTags,
      searchText,
      // NEW: Dedicated searchable fields
      room,
      roomNormalized,
      vendors,
      vendorIds,
      categories,
      colors,
      materials,
      styles,
      mood,
      elements,
      engagementScore,
      editorialScore: 0, // TODO: Calculate from editorial assignments
    },
    update: {
      projectId: project.id,
      designerId: project.designerId || project.ownerId,
      designerName: project.designer?.name || 'Unknown',
      projectTitle: project.title || '',
      isPublic: project.isPublic,
      publishedAt: project.publishedAt,
      combinedTags,
      searchText,
      // NEW: Update dedicated searchable fields
      room,
      roomNormalized,
      vendors,
      vendorIds,
      categories,
      colors,
      materials,
      styles,
      mood,
      elements,
      engagementScore,
      updatedAt: new Date(),
    },
  });
}

/**
 * Index all images in a project
 */
export async function reindexProject(projectId: string): Promise<void> {
  const images = await prisma.projectImage.findMany({
    where: { projectId },
    select: { id: true },
  });
  
  for (const image of images) {
    try {
      await indexMoment(image.id);
    } catch (error) {
      console.error(`Failed to index moment ${image.id}:`, error);
      // Continue with other images
    }
  }
}

/**
 * Batch job for full reindex
 * Processes in batches to avoid overwhelming the database
 */
export async function runFullReindex(batchSize: number = 100): Promise<void> {
  let cursor: string | undefined = undefined;
  let hasMore = true;
  
  while (hasMore) {
    const images = await prisma.projectImage.findMany({
      take: batchSize,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    
    if (images.length === 0) {
      hasMore = false;
      break;
    }
    
    for (const image of images) {
      try {
        await indexMoment(image.id);
      } catch (error) {
        console.error(`Failed to index moment ${image.id}:`, error);
        // Continue with other images
      }
    }
    
    cursor = images[images.length - 1].id;
    hasMore = images.length === batchSize;
    
    console.log(`Indexed batch, cursor: ${cursor}`);
  }
  
  console.log('Full reindex complete');
}

