import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { searchMoments, SearchFilters } from '@/lib/search/searchMoments';

export const dynamic = 'force-dynamic';

/**
 * GET /api/search/moments
 * 
 * Query params:
 *   q: string (search query)
 *   scope: 'public' | 'private'
 *   lens?: string (lens identifier)
 *   room?: string (room type filter)
 *   vendor?: string (vendor name filter)
 *   vendorId?: string (vendor ID filter)
 *   category?: string (category filter)
 *   color?: string (color filter)
 *   material?: string (material filter)
 *   style?: string (style filter)
 *   designerIds?: string (comma-separated designer user IDs)
 *   vendorIds?: string (comma-separated vendor org IDs)
 *   limit?: number (default 40)
 *   cursor?: string (pagination)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const { searchParams } = new URL(request.url);
    
    const query = searchParams.get('q') || '';
    const scope = (searchParams.get('scope') || 'public') as 'public' | 'private';
    const lens = searchParams.get('lens') || undefined;
    const limit = parseInt(searchParams.get('limit') || '40', 10);
    const cursor = searchParams.get('cursor') || undefined;
    
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

    const designerIdsParam = searchParams.get('designerIds');
    const vendorIdsParam = searchParams.get('vendorIds');
    if (designerIdsParam) filters.designerIds = designerIdsParam.split(',').filter(Boolean);
    if (vendorIdsParam) filters.vendorIds = vendorIdsParam.split(',').filter(Boolean);
    
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
    
    // Execute search
    const result = await searchMoments({
      query,
      scope,
      userId: session?.user?.id,
      lens,
      filters: Object.keys(filters).length > 0 ? filters : undefined,
      limit: Math.min(limit, 100), // Cap at 100
      cursor,
    });
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('[GET /api/search/moments] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to search moments' },
      { status: 500 }
    );
  }
}

