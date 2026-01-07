import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { getDesignerVendorDirectory } from '@/server/queries/getDesignerVendorDirectory';
import { DirectoryFilters } from '@/types/directory';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const designerId = session.user.id;

    // Get query parameters for filtering
    const { searchParams } = new URL(request.url);
    const filters: DirectoryFilters = {
      vendor: searchParams.get('vendor') || undefined,
      project: searchParams.get('project') || undefined,
      room: searchParams.get('room') || undefined,
      category: searchParams.get('category') || undefined,
      search: searchParams.get('search') || undefined,
    };

    // Get directory entries
    let entries = await getDesignerVendorDirectory(designerId);

    // Apply filters
    if (filters.vendor) {
      entries = entries.filter(entry => 
        entry.productBrand?.toLowerCase().includes(filters.vendor!.toLowerCase())
      );
    }

    if (filters.project) {
      entries = entries.filter(entry =>
        entry.projects.some(p => p.projectId === filters.project)
      );
    }

    if (filters.room) {
      entries = entries.filter(entry =>
        entry.projects.some(p => 
          p.roomName?.toLowerCase().includes(filters.room!.toLowerCase())
        )
      );
    }

    if (filters.category) {
      entries = entries.filter(entry =>
        entry.productCategory?.toLowerCase().includes(filters.category!.toLowerCase())
      );
    }

    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      entries = entries.filter(entry =>
        entry.productName.toLowerCase().includes(searchLower) ||
        entry.productBrand?.toLowerCase().includes(searchLower) ||
        entry.projects.some(p => 
          p.projectTitle.toLowerCase().includes(searchLower)
        )
      );
    }

    // Calculate stats
    const stats = {
      totalProducts: entries.length,
      totalVendors: new Set(entries.map(e => e.productBrand).filter(Boolean)).size,
      totalProjects: new Set(entries.flatMap(e => e.projects.map(p => p.projectId))).size,
    };

    return NextResponse.json({
      entries,
      stats,
      filters,
    });

  } catch (error: any) {
    console.error('[API] /api/designer/directory error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch directory' },
      { status: 500 }
    );
  }
}

