import { prisma } from '@/lib/prisma';
import { getLensById } from './lenses';
import { applyLens } from './applyLens';

export interface MomentResult {
  id: string;
  imageUrl: string;
  projectId: string;
  projectTitle: string;
  designerId: string;
  designerName: string;
  designerProfileImage?: string | null;
  tags: string[];
  products: Array<{
    id: string;
    name: string;
    vendorName?: string | null;
  }>;
  isPublished: boolean;
  engagementScore: number;
  relevanceScore: number;
  tagCompletionScore: number;
  combinedScore: number;
}

export interface MomentSearchResult {
  moments: MomentResult[];
  edition: {
    title: string;
    momentCount: number;
  };
  nextCursor?: string;
}

export interface PrivateMomentSearchResult extends MomentSearchResult {
  moments: Array<MomentResult & { section: 'published' | 'unpublished' }>;
}

/**
 * Generate edition title from query
 */
function generateEditionTitle(query: string): string {
  if (!query || query.trim().length === 0) {
    return 'All Moments';
  }
  
  // Capitalize first letter of each word
  const words = query.trim().split(/\s+/);
  const title = words
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
  
  return `${title} Edition`;
}

/**
 * Parse query for semantic intent
 * Returns normalized search terms
 */
function parseQuery(query: string): string[] {
  if (!query || query.trim().length === 0) {
    return [];
  }
  
  // Split by spaces and normalize
  return query
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .filter(term => term.length > 0);
}

/**
 * Normalize search query for room matching
 * Handles underscores, spaces, and pluralization
 */
export function normalizeSearchQuery(query: string): {
  original: string;
  normalized: string;
  terms: string[];
  roomVariants: string[];
} {
  const original = query.trim();
  const normalized = original
    .toLowerCase()
    .replace(/_/g, ' ')     // living_rooms → living rooms
    .replace(/-/g, ' ')     // living-rooms → living rooms
    .trim();
  
  const terms = normalized.split(/\s+/).filter(Boolean);
  
  // Generate room variants for matching
  const roomNormalized = normalized.replace(/\s+/g, ''); // "living room" → "livingroom"
  const roomVariants = [
    normalized,                          // "living room"
    roomNormalized,                      // "livingroom"
    normalized.replace(/s$/, ''),        // "living room" (remove trailing s)
    roomNormalized.replace(/s$/, ''),    // "livingroom" (remove trailing s)
  ].filter((v, i, arr) => arr.indexOf(v) === i); // Deduplicate
  
  return { original, normalized, terms, roomVariants };
}

export interface SearchFilters {
  room?: string;
  vendor?: string;
  vendorId?: string;
  category?: string;
  color?: string;
  material?: string;
  style?: string;
}

/**
 * Calculate relevance score for a moment
 * Explicit tags rank higher than AI-detected
 */
function calculateRelevanceScore(
  searchTerms: string[],
  explicitTags: string[],
  aiTags: string[],
  searchText: string
): number {
  if (searchTerms.length === 0) {
    return 1.0; // No query = all results equally relevant
  }
  
  let score = 0;
  
  // Check explicit tags (priority weight: 1.0)
  for (const term of searchTerms) {
    for (const tag of explicitTags) {
      if (tag.toLowerCase().includes(term) || term.includes(tag.toLowerCase())) {
        score += 1.0;
      }
    }
  }
  
  // Check AI-detected tags (weight: 0.6)
  for (const term of searchTerms) {
    for (const tag of aiTags) {
      if (tag.toLowerCase().includes(term) || term.includes(tag.toLowerCase())) {
        score += 0.6;
      }
    }
  }
  
  // Check search text (weight: 0.3)
  const lowerSearchText = searchText.toLowerCase();
  for (const term of searchTerms) {
    if (lowerSearchText.includes(term)) {
      score += 0.3;
    }
  }
  
  // Normalize to 0-1 range
  const maxPossibleScore = searchTerms.length * (1.0 + 0.6 + 0.3);
  return Math.min(score / maxPossibleScore, 1.0);
}

/**
 * Calculate tag completion score
 * Rewards moments where designers have explicitly tagged products
 * Formula: explicitTagCount / max(aiDetectedCount, 1)
 */
function calculateTagCompletionScore(
  explicitTagCount: number,
  aiDetectedCount: number
): number {
  if (aiDetectedCount === 0) {
    // If no AI detection, reward explicit tags
    return explicitTagCount > 0 ? 1.0 : 0.5;
  }
  // Ratio of explicit to AI-detected, capped at 1.0
  return Math.min(explicitTagCount / aiDetectedCount, 1.0);
}

/**
 * Search moments with query, scope, lens, and filter support
 */
export async function searchMoments(params: {
  query: string;
  scope: 'public' | 'private';
  userId?: string; // Required for private scope
  lens?: string;
  filters?: SearchFilters;
  limit?: number;
  cursor?: string;
}): Promise<MomentSearchResult | PrivateMomentSearchResult> {
  const {
    query,
    scope,
    userId,
    lens,
    filters,
    limit = 40,
    cursor,
  } = params;
  
  if (scope === 'private' && !userId) {
    throw new Error('userId is required for private scope');
  }
  
  // Normalize search query
  const { normalized, terms, roomVariants } = normalizeSearchQuery(query);
  const searchTerms = terms;
  
  // Build base where clause
  const where: any = {};
  
  // Apply scope filter
  if (scope === 'public') {
    // Public: isPublic = true AND publishedAt IS NOT NULL
    where.isPublic = true;
    where.publishedAt = { not: null };
  } else {
    // Private: designerId = userId (include unpublished)
    where.designerId = userId;
  }
  
  // Apply direct filters (from UI pills) - these are AND conditions
  const filterConditions: any[] = [];
  
  if (filters?.room) {
    const roomNorm = filters.room.toLowerCase().replace(/[\s_-]+/g, '');
    filterConditions.push({ roomNormalized: roomNorm });
  }
  
  if (filters?.vendorId) {
    filterConditions.push({ vendorIds: { has: filters.vendorId } });
  }
  
  if (filters?.vendor) {
    filterConditions.push({ vendors: { has: filters.vendor.toLowerCase() } });
  }
  
  if (filters?.category) {
    filterConditions.push({ categories: { has: filters.category.toLowerCase() } });
  }
  
  if (filters?.color) {
    filterConditions.push({ colors: { has: filters.color.toLowerCase() } });
  }
  
  if (filters?.material) {
    filterConditions.push({ materials: { has: filters.material.toLowerCase() } });
  }
  
  if (filters?.style) {
    filterConditions.push({ styles: { has: filters.style.toLowerCase() } });
  }
  
  // Apply query filter if provided
  if (searchTerms.length > 0) {
    // Detect if this looks like a room-type query
    // Common room types: living room, kitchen, bedroom, dining room, bathroom, etc.
    const commonRooms = [
      'living room', 'kitchen', 'bedroom', 'dining room', 'bathroom',
      'bath', 'master bedroom', 'guest bedroom', 'home office', 'office',
      'outdoor', 'exterior', 'patio', 'pool', 'deck', 'balcony',
      'entryway', 'foyer', 'hallway', 'mudroom', 'laundry room',
      'basement', 'attic', 'garage', 'closet', 'pantry'
    ];
    
    // Separate room terms from attribute terms (colors, styles, materials, etc.)
    const roomTerms: string[] = [];
    const attributeTerms: string[] = [];
    
    for (const term of searchTerms) {
      const isRoomTerm = commonRooms.some(room => 
        term.includes(room) || room.includes(term) || normalized.includes(room)
      );
      if (isRoomTerm) {
        roomTerms.push(term);
      } else {
        attributeTerms.push(term);
      }
    }
    
    const hasRoomTerms = roomTerms.length > 0;
    const hasAttributeTerms = attributeTerms.length > 0;
    
    const queryConditions: any[] = [];
    
    // If query contains room terms, match on room field
    if (hasRoomTerms) {
      const roomNormalized = roomTerms.join(' ').toLowerCase().replace(/[\s_-]+/g, '');
      queryConditions.push(
        // Exact roomNormalized match (handles "living_rooms" → "livingroom")
        {
          roomNormalized: {
            equals: roomNormalized,
          },
        },
        // Room field contains room terms (case-insensitive)
        {
          room: {
            contains: roomTerms.join(' '),
            mode: 'insensitive',
          },
        }
      );
    }
    
    // If query contains attribute terms (colors, styles, materials, etc.), match on those fields
    if (hasAttributeTerms) {
      // Match attributes in dedicated fields (layered with room)
      queryConditions.push(
        // Match colors
        {
          colors: {
            hasSome: attributeTerms,
          },
        },
        // Match materials
        {
          materials: {
            hasSome: attributeTerms,
          },
        },
        // Match styles
        {
          styles: {
            hasSome: attributeTerms,
          },
        },
        // Match mood
        {
          mood: {
            hasSome: attributeTerms,
          },
        },
        // Match elements
        {
          elements: {
            hasSome: attributeTerms,
          },
        },
        // Match categories
        {
          categories: {
            hasSome: attributeTerms,
          },
        },
        // Match vendors
        {
          vendors: {
            hasSome: attributeTerms,
          },
        },
        // Fallback: match in combinedTags and searchText
        {
          combinedTags: {
            hasSome: attributeTerms,
          },
        },
        {
          searchText: {
            contains: attributeTerms.join(' '),
            mode: 'insensitive',
          },
        }
      );
    }
    
    // If query has both room and attribute terms, combine with AND (layered attributes)
    // If only one type, use OR for that type
    if (hasRoomTerms && hasAttributeTerms) {
      // Multi-term query with both room and attributes: match BOTH
      // Example: "green kitchen" → room="kitchen" AND colors contains "green"
      queryConditions.length = 0; // Reset to rebuild with AND logic
      queryConditions.push({
        AND: [
          // Room conditions
          {
            OR: [
              ...roomVariants.map(variant => ({
                roomNormalized: {
                  equals: variant.replace(/\s+/g, ''),
                },
              })),
              {
                room: {
                  contains: roomTerms.join(' '),
                  mode: 'insensitive',
                },
              },
            ],
          },
          // Attribute conditions (colors, styles, materials, etc.)
          {
            OR: [
              { colors: { hasSome: attributeTerms } },
              { materials: { hasSome: attributeTerms } },
              { styles: { hasSome: attributeTerms } },
              { mood: { hasSome: attributeTerms } },
              { elements: { hasSome: attributeTerms } },
              { categories: { hasSome: attributeTerms } },
              { vendors: { hasSome: attributeTerms } },
              { combinedTags: { hasSome: attributeTerms } },
              { searchText: { contains: attributeTerms.join(' '), mode: 'insensitive' } },
            ],
          },
        ],
      });
    }
    
    // If no specific terms matched, use original broad matching as fallback
    if (queryConditions.length === 0 && searchTerms.length > 0) {
      queryConditions.push(
        // Match in combined tags (array contains)
        {
          combinedTags: {
            hasSome: searchTerms,
          },
        },
        // Match in searchText (full-text fallback)
        {
          searchText: {
            contains: normalized,
            mode: 'insensitive',
          },
        },
        // Match room (exact or contains)
        {
          room: {
            contains: normalized,
            mode: 'insensitive',
          },
        },
        // Match roomNormalized (handles "living_rooms" → "livingroom")
        ...roomVariants.map(variant => ({
          roomNormalized: {
            equals: variant.replace(/\s+/g, ''),
          },
        })),
        // Match vendors (array contains any term)
        {
          vendors: {
            hasSome: searchTerms,
          },
        },
        // Match categories
        {
          categories: {
            hasSome: searchTerms,
          },
        },
        // Match colors
        {
          colors: {
            hasSome: searchTerms,
          },
        },
        // Match materials
        {
          materials: {
            hasSome: searchTerms,
          },
        },
        // Match styles
        {
          styles: {
            hasSome: searchTerms,
          },
        },
        // Match mood
        {
          mood: {
            hasSome: searchTerms,
          },
        },
        // Match elements
        {
          elements: {
            hasSome: searchTerms,
          },
        },
      );
    }
    
    // Combine filters and query: filters are AND, query is OR
    if (filterConditions.length > 0) {
      where.AND = [
        ...filterConditions,
        {
          OR: queryConditions,
        },
      ];
    } else {
      where.OR = queryConditions;
    }
  } else if (filterConditions.length > 0) {
    // Only filters, no query
    if (filterConditions.length === 1) {
      Object.assign(where, filterConditions[0]);
    } else {
      where.AND = filterConditions;
    }
  }
  
  // Fetch moments from MomentIndex
  // Note: Using select to avoid Prisma type mismatch issues with combinedTags
  // TODO: Remove this workaround after Prisma client is regenerated
  const moments = await prisma.momentIndex.findMany({
    where,
    take: limit + 1, // Fetch one extra to check for next page
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    orderBy: [
      { engagementScore: 'desc' },
      { updatedAt: 'desc' },
    ],
    select: {
      id: true,
      projectImageId: true,
      projectId: true,
      designerId: true,
      designerName: true,
      projectTitle: true,
      isPublic: true,
      publishedAt: true,
      combinedTags: true,
      searchText: true,
      engagementScore: true,
      room: true,
      roomNormalized: true,
      vendors: true,
      vendorIds: true,
      categories: true,
      colors: true,
      materials: true,
      styles: true,
      projectImage: {
        select: {
          id: true,
          url: true,
          aiTags: true,
          tags: {
            include: {
              product: {
                include: {
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
          project: {
            include: {
              designer: {
                select: {
                  id: true,
                  name: true,
                  profileImage: true,
                },
              },
            },
          },
        },
      },
    },
  });
  
  // Check if there's a next page
  const hasNextPage = moments.length > limit;
  const results = hasNextPage ? moments.slice(0, limit) : moments;
  const nextCursor = hasNextPage ? results[results.length - 1].id : undefined;
  
  // Map to MomentResult format
  let momentResults: MomentResult[] = results.map((moment) => {
    const projectImage = moment.projectImage;
    const project = projectImage.project;
    const designer = project.designer;
    
    // Calculate relevance score
    const explicitTags = projectImage.tags.map(t => t.product.name.toLowerCase());
    const explicitTagCount = projectImage.tags.length;
    // Get AI-detected tags count from ProjectImage or use combinedTags length as fallback
    const aiDetectedCount = (projectImage.aiTags as string[])?.length || 
                            moment.combinedTags.length || 
                            0;
    
    const relevanceScore = calculateRelevanceScore(
      searchTerms,
      explicitTags,
      moment.combinedTags,
      moment.searchText
    );
    
    // Calculate tag completion score
    const tagCompletionScore = calculateTagCompletionScore(explicitTagCount, aiDetectedCount);
    
    // Normalize engagement score to 0-1 range (assuming max engagement score is around 100)
    const normalizedEngagementScore = Math.min(moment.engagementScore / 100, 1.0);
    
    // Combined score: 40% relevance + 35% tag completion + 25% engagement
    const combinedScore = (
      relevanceScore * 0.40 +
      tagCompletionScore * 0.35 +
      normalizedEngagementScore * 0.25
    );
    
    return {
      id: projectImage.id,
      imageUrl: projectImage.url,
      projectId: moment.projectId,
      projectTitle: moment.projectTitle,
      designerId: moment.designerId,
      designerName: moment.designerName,
      designerProfileImage: designer?.profileImage || null,
      tags: moment.combinedTags,
      products: projectImage.tags.map(t => ({
        id: t.product.id,
        name: t.product.name,
        vendorName: t.product.vendor?.companyName || t.product.vendor?.name || null,
      })),
      isPublished: moment.isPublic && moment.publishedAt !== null,
      engagementScore: moment.engagementScore,
      relevanceScore,
      tagCompletionScore,
      combinedScore,
    };
  });
  
  // Sort by combined score (40% relevance + 35% tag completion + 25% engagement)
  momentResults.sort((a, b) => {
    return b.combinedScore - a.combinedScore;
  });
  
  // Apply lens if provided
  if (lens) {
    const lensDef = getLensById(lens);
    if (lensDef) {
      // Apply lens re-weighting
      const lensedResults = applyLens(momentResults, lensDef);
      
      // For private scope with status lens, filter appropriately
      if (scope === 'private' && lensDef.type === 'status') {
        if (lens === 'status-published') {
          const filtered = lensedResults.filter(m => m.isPublished);
          return {
            ...(scope === 'private' ? {
              moments: filtered.map(m => ({ ...m, section: 'published' as const })),
            } : { moments: filtered }),
            edition: {
              title: generateEditionTitle(query),
              momentCount: filtered.length,
            },
            nextCursor,
          } as any;
        } else if (lens === 'status-unpublished') {
          const filtered = lensedResults.filter(m => !m.isPublished);
          return {
            moments: filtered.map(m => ({ ...m, section: 'unpublished' as const })),
            edition: {
              title: generateEditionTitle(query),
              momentCount: filtered.length,
            },
            nextCursor,
          } as any;
        }
      }
      
      // Update momentResults with lensed ordering
      momentResults = lensedResults;
    }
  }
  
  // For private scope, separate published vs unpublished
  if (scope === 'private') {
    const published: Array<MomentResult & { section: 'published' }> = [];
    const unpublished: Array<MomentResult & { section: 'unpublished' }> = [];
    
    for (const moment of momentResults) {
      if (moment.isPublished) {
        published.push({ ...moment, section: 'published' });
      } else {
        unpublished.push({ ...moment, section: 'unpublished' });
      }
    }
    
    const privateResult: PrivateMomentSearchResult = {
      moments: [...published, ...unpublished],
      edition: {
        title: generateEditionTitle(query),
        momentCount: momentResults.length,
      },
      nextCursor,
    };
    
    return privateResult;
  }
  
  // Public scope
  return {
    moments: momentResults,
    edition: {
      title: generateEditionTitle(query),
      momentCount: momentResults.length,
    },
    nextCursor,
  };
}

