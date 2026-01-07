import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { normalizeSearchQuery } from '@/lib/search/searchMoments';
import type { SearchFilters } from '@/lib/search/searchMoments';

export const dynamic = 'force-dynamic';

interface Facet {
  value: string;
  label: string;
  count: number;
}

interface FilterOptionsResponse {
  facets: {
    styles: Facet[];
    materials: Facet[];
    colors: Facet[];
    vendors: Facet[];
    categories: Facet[];
    mood: Facet[];
    elements: Facet[];
  };
  activeFilters: Record<string, string>;
  totalResults: number;
  _debug?: {
    totalResults: number;
    sampleRecord?: any;
    hasAnyRecords: boolean;
  };
}

/**
 * Build where clause matching searchMoments logic
 */
function buildWhereClause(
  query: string,
  scope: 'public' | 'private',
  userId: string | undefined,
  filters?: SearchFilters
): any {
  const { normalized, terms, roomVariants } = normalizeSearchQuery(query);
  const searchTerms = terms;
  
  const where: any = {};
  
  // Apply scope filter
  if (scope === 'public') {
    where.isPublic = true;
    where.publishedAt = { not: null };
  } else {
    where.designerId = userId;
  }
  
  // Apply direct filters
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
    const queryConditions: any[] = [
      { combinedTags: { hasSome: searchTerms } },
      { searchText: { contains: normalized, mode: 'insensitive' } },
      { room: { contains: normalized, mode: 'insensitive' } },
      ...roomVariants.map(variant => ({
        roomNormalized: { equals: variant.replace(/\s+/g, '') },
      })),
      { vendors: { hasSome: searchTerms } },
      { categories: { hasSome: searchTerms } },
      { colors: { hasSome: searchTerms } },
      { materials: { hasSome: searchTerms } },
      { styles: { hasSome: searchTerms } },
    ];
    
    if (filterConditions.length > 0) {
      where.AND = [
        ...filterConditions,
        { OR: queryConditions },
      ];
    } else {
      where.OR = queryConditions;
    }
  } else if (filterConditions.length > 0) {
    if (filterConditions.length === 1) {
      Object.assign(where, filterConditions[0]);
    } else {
      where.AND = filterConditions;
    }
  }
  
  return where;
}

/**
 * Capitalize first letter of each word for labels
 */
function formatLabel(value: string): string {
  return value
    .split(/[\s_-]+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Aggregate facets from array fields
 * Fetches matching records and aggregates in JavaScript for type safety
 */
async function aggregateFacets(
  whereClause: any,
  excludeField?: string
): Promise<{
  styles: Facet[];
  materials: Facet[];
  colors: Facet[];
  vendors: Facet[];
  categories: Facet[];
  mood: Facet[];
  elements: Facet[];
}> {
  console.log('[aggregateFacets] Starting aggregation, excludeField:', excludeField);
  
  // Fetch matching records with array fields
  const matchingRecords = await prisma.momentIndex.findMany({
    where: whereClause,
    select: {
      styles: true,
      materials: true,
      colors: true,
      vendors: true,
      categories: true,
      mood: true,
      elements: true,
    },
  });
  
  console.log('[aggregateFacets] Found', matchingRecords.length, 'matching records');
  
  if (matchingRecords.length === 0) {
    console.log('[aggregateFacets] No matching records, returning empty facets');
    return {
      styles: [],
      materials: [],
      colors: [],
      vendors: [],
      categories: [],
      mood: [],
      elements: [],
    };
  }
  
  // Log sample of first record to see what data structure looks like
  if (matchingRecords.length > 0) {
    console.log('[aggregateFacets] Sample record:', {
      hasStyles: !!matchingRecords[0].styles,
      stylesLength: matchingRecords[0].styles?.length || 0,
      stylesSample: matchingRecords[0].styles?.slice(0, 3) || [],
      hasMaterials: !!matchingRecords[0].materials,
      materialsLength: matchingRecords[0].materials?.length || 0,
      materialsSample: matchingRecords[0].materials?.slice(0, 3) || [],
      hasColors: !!matchingRecords[0].colors,
      colorsLength: matchingRecords[0].colors?.length || 0,
      colorsSample: matchingRecords[0].colors?.slice(0, 3) || [],
      hasVendors: !!matchingRecords[0].vendors,
      vendorsLength: matchingRecords[0].vendors?.length || 0,
      vendorsSample: matchingRecords[0].vendors?.slice(0, 3) || [],
      hasCategories: !!matchingRecords[0].categories,
      categoriesLength: matchingRecords[0].categories?.length || 0,
      categoriesSample: matchingRecords[0].categories?.slice(0, 3) || [],
    });
  }
  
  // Aggregate in JavaScript
  const styleCounts: Record<string, number> = {};
  const materialCounts: Record<string, number> = {};
  const colorCounts: Record<string, number> = {};
  const vendorCounts: Record<string, number> = {};
  const categoryCounts: Record<string, number> = {};
  const moodCounts: Record<string, number> = {};
  const elementCounts: Record<string, number> = {};
  
  let recordsWithData = 0;
  for (const record of matchingRecords) {
    let recordHasData = false;
    
    if (excludeField !== 'style' && record.styles && record.styles.length > 0) {
      recordHasData = true;
      for (const style of record.styles) {
        if (style && typeof style === 'string' && style.trim()) {
          styleCounts[style] = (styleCounts[style] || 0) + 1;
        }
      }
    }
    
    if (excludeField !== 'material' && record.materials && record.materials.length > 0) {
      recordHasData = true;
      for (const material of record.materials) {
        if (material && typeof material === 'string' && material.trim()) {
          materialCounts[material] = (materialCounts[material] || 0) + 1;
        }
      }
    }
    
    if (excludeField !== 'color' && record.colors && record.colors.length > 0) {
      recordHasData = true;
      for (const color of record.colors) {
        if (color && typeof color === 'string' && color.trim()) {
          colorCounts[color] = (colorCounts[color] || 0) + 1;
        }
      }
    }
    
    if (excludeField !== 'vendor' && excludeField !== 'vendorId' && record.vendors && record.vendors.length > 0) {
      recordHasData = true;
      for (const vendor of record.vendors) {
        if (vendor && typeof vendor === 'string' && vendor.trim()) {
          vendorCounts[vendor] = (vendorCounts[vendor] || 0) + 1;
        }
      }
    }
    
    if (excludeField !== 'category' && record.categories && record.categories.length > 0) {
      recordHasData = true;
      for (const category of record.categories) {
        if (category && typeof category === 'string' && category.trim()) {
          categoryCounts[category] = (categoryCounts[category] || 0) + 1;
        }
      }
    }
    
    if (excludeField !== 'mood' && record.mood && record.mood.length > 0) {
      recordHasData = true;
      for (const m of record.mood) {
        if (m && typeof m === 'string' && m.trim()) {
          moodCounts[m] = (moodCounts[m] || 0) + 1;
        }
      }
    }
    
    if (excludeField !== 'element' && record.elements && record.elements.length > 0) {
      recordHasData = true;
      for (const e of record.elements) {
        if (e && typeof e === 'string' && e.trim()) {
          elementCounts[e] = (elementCounts[e] || 0) + 1;
        }
      }
    }
    
    if (recordHasData) recordsWithData++;
  }
  
  console.log('[aggregateFacets] Records with data:', recordsWithData, 'out of', matchingRecords.length);
  
  // Convert to sorted arrays
  const toFacets = (counts: Record<string, number>): Facet[] => {
    return Object.entries(counts)
      .map(([value, count]) => ({
        value,
        label: formatLabel(value),
        count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);
  };
  
  const result = {
    styles: toFacets(styleCounts),
    materials: toFacets(materialCounts),
    colors: toFacets(colorCounts),
    vendors: toFacets(vendorCounts),
    categories: toFacets(categoryCounts),
    mood: toFacets(moodCounts),
    elements: toFacets(elementCounts),
  };
  
  console.log('[aggregateFacets] Final counts:', {
    styles: Object.keys(styleCounts).length,
    materials: Object.keys(materialCounts).length,
    colors: Object.keys(colorCounts).length,
    vendors: Object.keys(vendorCounts).length,
    categories: Object.keys(categoryCounts).length,
    mood: Object.keys(moodCounts).length,
    elements: Object.keys(elementCounts).length,
  });
  
  return result;
}

/**
 * GET /api/search/filters
 * 
 * Returns available filter facets based on current search query and filters
 * 
 * Query params: Same as /api/search/moments
 */
export async function GET(request: NextRequest) {
  try {
    console.log('[FilterAPI] Request received');
    const session = await getServerSession(authOptions);
    const { searchParams } = new URL(request.url);
    
    const query = searchParams.get('q') || '';
    const scope = (searchParams.get('scope') || 'public') as 'public' | 'private';
    const lens = searchParams.get('lens') || undefined;
    
    console.log('[FilterAPI] Params:', { query, scope, lens });
    
    // Extract filter parameters
    const filters: SearchFilters = {};
    const room = searchParams.get('room');
    const vendor = searchParams.get('vendor');
    const vendorId = searchParams.get('vendorId');
    const category = searchParams.get('category');
    const color = searchParams.get('color');
    const material = searchParams.get('material');
    const style = searchParams.get('style');
    
    if (room) filters.room = room;
    if (vendor) filters.vendor = vendor;
    if (vendorId) filters.vendorId = vendorId;
    if (category) filters.category = category;
    if (color) filters.color = color;
    if (material) filters.material = material;
    if (style) filters.style = style;
    
    // Validate scope
    if (scope !== 'public' && scope !== 'private') {
      return NextResponse.json(
        { error: 'Invalid scope. Must be "public" or "private"' },
        { status: 400 }
      );
    }
    
    // For private scope, require authentication
    if (scope === 'private') {
      if (!session?.user?.id) {
        return NextResponse.json(
          { error: 'Unauthorized. Private search requires authentication.' },
          { status: 401 }
        );
      }
    }
    
    // Build where clause (same logic as searchMoments)
    const whereClause = buildWhereClause(query, scope, session?.user?.id, filters);
    console.log('[FilterAPI] Where clause built:', JSON.stringify(whereClause, null, 2));
    
    // Determine which field to exclude from facets
    let excludeField: string | undefined;
    if (filters.style) excludeField = 'style';
    else if (filters.material) excludeField = 'material';
    else if (filters.color) excludeField = 'color';
    else if (filters.vendor || filters.vendorId) excludeField = 'vendor';
    else if (filters.category) excludeField = 'category';
    else if (filters.room) excludeField = 'room';
    
    console.log('[FilterAPI] Exclude field:', excludeField);
    
    // Get total count
    const totalResults = await prisma.momentIndex.count({
      where: whereClause,
    });
    console.log('[FilterAPI] Total results:', totalResults);
    
    // Debug: Check a sample record to see what fields exist
    if (totalResults > 0) {
      const sample = await prisma.momentIndex.findFirst({
        where: whereClause,
        select: {
          id: true,
          styles: true,
          materials: true,
          colors: true,
          vendors: true,
          categories: true,
          room: true,
        },
      });
      console.log('[FilterAPI] Sample record structure:', {
        hasStyles: !!sample?.styles,
        stylesType: Array.isArray(sample?.styles) ? 'array' : typeof sample?.styles,
        stylesValue: sample?.styles,
        hasMaterials: !!sample?.materials,
        materialsType: Array.isArray(sample?.materials) ? 'array' : typeof sample?.materials,
        materialsValue: sample?.materials,
        hasColors: !!sample?.colors,
        colorsType: Array.isArray(sample?.colors) ? 'array' : typeof sample?.colors,
        colorsValue: sample?.colors,
        hasVendors: !!sample?.vendors,
        vendorsType: Array.isArray(sample?.vendors) ? 'array' : typeof sample?.vendors,
        vendorsValue: sample?.vendors,
        hasCategories: !!sample?.categories,
        categoriesType: Array.isArray(sample?.categories) ? 'array' : typeof sample?.categories,
        categoriesValue: sample?.categories,
        room: sample?.room,
      });
    } else {
      console.log('[FilterAPI] No records found matching where clause');
      
      // Check if ANY records exist at all
      const anyRecord = await prisma.momentIndex.findFirst({
        select: {
          id: true,
          styles: true,
          materials: true,
          colors: true,
          vendors: true,
          categories: true,
          isPublic: true,
          publishedAt: true,
        },
      });
      console.log('[FilterAPI] Any record in database:', {
        exists: !!anyRecord,
        isPublic: anyRecord?.isPublic,
        publishedAt: anyRecord?.publishedAt,
        hasStyles: !!anyRecord?.styles,
        stylesLength: Array.isArray(anyRecord?.styles) ? anyRecord.styles.length : 'not array',
      });
    }
    
    // Aggregate facets
    const facets = await aggregateFacets(whereClause, excludeField);
    console.log('[FilterAPI] Aggregated facets:', {
      styles: facets.styles.length,
      materials: facets.materials.length,
      colors: facets.colors.length,
      vendors: facets.vendors.length,
      categories: facets.categories.length,
    });
    
    // Build active filters object
    const activeFilters: Record<string, string> = {};
    if (room) activeFilters.room = room;
    if (vendor) activeFilters.vendor = vendor;
    if (vendorId) activeFilters.vendorId = vendorId;
    if (category) activeFilters.category = category;
    if (color) activeFilters.color = color;
    if (material) activeFilters.material = material;
    if (style) activeFilters.style = style;
    
    // Get debug info
    let debugInfo: any = {
      totalResults,
      hasAnyRecords: false,
    };
    
    if (totalResults > 0) {
      const sample = await prisma.momentIndex.findFirst({
        where: whereClause,
        select: {
          id: true,
          styles: true,
          materials: true,
          colors: true,
          vendors: true,
          categories: true,
          room: true,
        },
      });
      debugInfo.sampleRecord = {
        hasStyles: !!sample?.styles,
        stylesLength: Array.isArray(sample?.styles) ? sample.styles.length : 0,
        stylesType: Array.isArray(sample?.styles) ? 'array' : typeof sample?.styles,
        hasMaterials: !!sample?.materials,
        materialsLength: Array.isArray(sample?.materials) ? sample.materials.length : 0,
        hasColors: !!sample?.colors,
        colorsLength: Array.isArray(sample?.colors) ? sample.colors.length : 0,
        hasVendors: !!sample?.vendors,
        vendorsLength: Array.isArray(sample?.vendors) ? sample.vendors.length : 0,
        hasCategories: !!sample?.categories,
        categoriesLength: Array.isArray(sample?.categories) ? sample.categories.length : 0,
        room: sample?.room,
      };
    } else {
      // Check if ANY records exist
      const anyRecord = await prisma.momentIndex.findFirst({
        select: {
          id: true,
          isPublic: true,
          publishedAt: true,
        },
      });
      debugInfo.hasAnyRecords = !!anyRecord;
      debugInfo.anyRecordInfo = anyRecord ? {
        isPublic: anyRecord.isPublic,
        publishedAt: anyRecord.publishedAt,
      } : null;
    }
    
    const response: FilterOptionsResponse = {
      facets,
      activeFilters,
      totalResults,
      _debug: debugInfo,
    };
    
    console.log('[FilterAPI] Returning response with', {
      facetsCounts: {
        styles: facets.styles.length,
        materials: facets.materials.length,
        colors: facets.colors.length,
        vendors: facets.vendors.length,
        categories: facets.categories.length,
      },
      activeFiltersCount: Object.keys(activeFilters).length,
      totalResults,
      debug: debugInfo,
    });
    
    return NextResponse.json(response);
  } catch (error) {
    console.error('[GET /api/search/filters] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get filter options' },
      { status: 500 }
    );
  }
}

