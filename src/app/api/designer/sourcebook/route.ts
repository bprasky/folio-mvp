export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { getSourcebookEntries } from '@/server/queries/getSourcebookEntries';
import type { SourcebookFilters } from '@/types/sourcebook';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const designerId = session.user.id;
    const { searchParams } = new URL(request.url);

    const filters: SourcebookFilters = {
      vendor: searchParams.get('vendor') || undefined,
      project: searchParams.get('project') || undefined,
      room: searchParams.get('room') || undefined,
      category: searchParams.get('category') || undefined,
      search: searchParams.get('search') || undefined,
      archived: searchParams.get('archived') === 'true',
    };

    // Get entries — include archived only when the archived filter is active
    let entries = await getSourcebookEntries(designerId, filters.archived);

    // If archived filter is on, show only archived entries
    if (filters.archived) {
      entries = entries.filter(e => e.archived);
    }

    // Apply text/category filters
    if (filters.vendor) {
      const vendorLower = filters.vendor.toLowerCase();
      entries = entries.filter(e =>
        e.productBrand?.toLowerCase().includes(vendorLower)
      );
    }

    if (filters.project) {
      entries = entries.filter(e =>
        e.projects.some(p => p.projectId === filters.project)
      );
    }

    if (filters.room) {
      const roomLower = filters.room.toLowerCase();
      entries = entries.filter(e =>
        e.projects.some(p =>
          p.roomName?.toLowerCase().includes(roomLower)
        )
      );
    }

    if (filters.category) {
      const catLower = filters.category.toLowerCase();
      entries = entries.filter(e =>
        e.productCategory?.toLowerCase().includes(catLower)
      );
    }

    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      entries = entries.filter(e =>
        e.productName.toLowerCase().includes(searchLower) ||
        e.productBrand?.toLowerCase().includes(searchLower) ||
        e.projects.some(p =>
          p.projectTitle.toLowerCase().includes(searchLower)
        )
      );
    }

    // Calculate stats (count archived from the full set)
    const allEntries = await getSourcebookEntries(designerId, true);
    const archivedCount = allEntries.filter(e => e.archived).length;
    const activeEntries = allEntries.filter(e => !e.archived);

    const stats = {
      totalProducts: activeEntries.length,
      totalVendors: new Set(activeEntries.map(e => e.productBrand).filter(Boolean)).size,
      totalProjects: new Set(activeEntries.flatMap(e => e.projects.map(p => p.projectId))).size,
      archivedCount,
    };

    return NextResponse.json({ entries, stats, filters });
  } catch (error: unknown) {
    console.error('[API] /api/designer/sourcebook error:', error);
    return NextResponse.json({ error: 'Failed to fetch sourcebook' }, { status: 500 });
  }
}
