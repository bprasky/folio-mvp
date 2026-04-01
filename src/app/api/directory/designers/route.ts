export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import type { DirectoryDesigner, DirectoryListResponse, DirectorySortMode } from '@/lib/directory/types';

/**
 * GET /api/directory/designers
 * List designers in the directory with filtering, sorting, and bookmark support
 *
 * Query params:
 *   page, limit — pagination
 *   sort — 'recent' | 'alpha' | 'projects' | 'ranked' (default) | 'rising'
 *   region — filter by location substring
 *   style — filter by style substring
 *   bookmarked — 'true' to show only bookmarked professionals (requires auth)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)));
    const sort = (searchParams.get('sort') || 'recent') as DirectorySortMode;
    const style = searchParams.get('style') || undefined;
    const region = searchParams.get('region') || undefined;
    const bookmarkedOnly = searchParams.get('bookmarked') === 'true';
    const specifyingMyProducts = searchParams.get('specifyingMyProducts') === 'true';

    // Legacy: map old 'view' param to 'sort'
    const legacyView = searchParams.get('view');
    let effectiveSort = legacyView === 'rising' ? 'rising' : sort;

    // Critical mass threshold check for ranked sort
    // Ranked view only available when: 50+ in a metro, 200+ platform-wide, or admin-enabled
    if (effectiveSort === 'ranked') {
      const totalEligible = await prisma.directoryRanking.count({
        where: { rankingType: 'DESIGNER', isEligible: true, isVisible: true },
      });
      if (totalEligible < 200) {
        // Fall back to recent sort — threshold not met
        effectiveSort = 'recent';
      }
    }

    const skip = (page - 1) * limit;

    // Get session for bookmark features
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;

    // Get bookmarked IDs if needed
    let bookmarkedIds: Set<string> = new Set();
    if (userId && (bookmarkedOnly || true)) {
      const bookmarks = await prisma.directoryBookmark.findMany({
        where: { userId },
        select: { professionalId: true },
      });
      bookmarkedIds = new Set(bookmarks.map(b => b.professionalId));
    }

    if (effectiveSort === 'ranked' || effectiveSort === 'rising') {
      // Original ranking-based query
      return handleRankedQuery({
        page, limit, skip, effectiveSort, region, style, bookmarkedOnly, bookmarkedIds,
      });
    }

    // Browse mode: query users directly
    // Get vendor org ID for "specifying my products" filter
    let vendorOrgId: string | undefined;
    if (specifyingMyProducts && userId) {
      const vendorMembership = await prisma.organizationUser.findFirst({
        where: {
          userId,
          isActive: true,
          organization: { type: { in: ['VENDOR', 'MANUFACTURER', 'SHOWROOM'] } },
        },
        select: { organizationId: true },
      });
      vendorOrgId = vendorMembership?.organizationId;
    }

    return handleBrowseQuery({
      page, limit, skip, effectiveSort, region, style, bookmarkedOnly, bookmarkedIds,
      specifyingMyProducts, vendorOrgId,
    });
  } catch (error) {
    console.error('[API] /api/directory/designers error:', error);
    return NextResponse.json({ error: 'Failed to fetch directory' }, { status: 500 });
  }
}

async function handleRankedQuery({
  page, limit, skip, effectiveSort, region, style, bookmarkedOnly, bookmarkedIds,
}: {
  page: number; limit: number; skip: number; effectiveSort: string;
  region?: string; style?: string; bookmarkedOnly: boolean; bookmarkedIds: Set<string>;
}) {
  const whereClause: Record<string, unknown> = {
    rankingType: 'DESIGNER',
    isEligible: true,
    isVisible: true,
    rank: { not: null },
  };

  if (effectiveSort === 'rising') {
    whereClause.rankChange = { gt: 0 };
  }

  const total = await prisma.directoryRanking.count({ where: whereClause });

  const rankings = await prisma.directoryRanking.findMany({
    where: whereClause,
    orderBy: effectiveSort === 'rising' ? { rankChange: 'desc' } : { rank: 'asc' },
    skip,
    take: limit,
    include: {
      user: {
        select: {
          id: true,
          name: true,
          profileImage: true,
          location: true,
          title: true,
          bio: true,
          role: true,
          followers: true,
          designerProjects: {
            where: { isPublic: true, publishedAt: { not: null } },
            select: {
              id: true,
              title: true,
              saves: true,
              images: {
                take: 1,
                orderBy: { displayOrder: 'asc' },
                select: { url: true },
              },
            },
            orderBy: { saves: 'desc' },
            take: 1,
          },
        },
      },
    },
  });

  let filteredRankings = rankings;
  if (region) {
    const regionLower = region.toLowerCase();
    filteredRankings = filteredRankings.filter(
      r => r.user?.location?.toLowerCase().includes(regionLower) ?? false
    );
  }

  if (bookmarkedOnly) {
    filteredRankings = filteredRankings.filter(r => r.user && bookmarkedIds.has(r.user.id));
  }

  const designers: DirectoryDesigner[] = filteredRankings
    .filter(r => r.user)
    .map(r => {
      const user = r.user!;
      const projectCount = user.designerProjects?.length ?? 0;
      const totalSaves = user.designerProjects?.reduce((sum, p) => sum + p.saves, 0) ?? 0;
      const featuredProject = user.designerProjects?.[0];

      return {
        rank: r.rank!,
        rankChange: r.rankChange,
        user: {
          id: user.id,
          name: user.name,
          profileImage: user.profileImage,
          location: user.location,
          title: user.title,
          bio: user.bio,
          role: user.role,
        },
        stats: {
          projectCount,
          totalSaves,
          followerCount: user.followers,
        },
        featuredProject: featuredProject
          ? {
              id: featuredProject.id,
              title: featuredProject.title,
              heroImage: featuredProject.images[0]?.url ?? null,
            }
          : undefined,
        isBookmarked: bookmarkedIds.has(user.id),
      };
    });

  const response: DirectoryListResponse<DirectoryDesigner> = {
    items: designers,
    pagination: { page, limit, total, hasMore: skip + designers.length < total },
    lastUpdated: new Date(),
  };

  return NextResponse.json(response);
}

async function handleBrowseQuery({
  page, limit, skip, effectiveSort, region, style, bookmarkedOnly, bookmarkedIds, specifyingMyProducts, vendorOrgId,
}: {
  page: number; limit: number; skip: number; effectiveSort: string;
  region?: string; style?: string; bookmarkedOnly: boolean; bookmarkedIds: Set<string>;
  specifyingMyProducts?: boolean; vendorOrgId?: string;
}) {
  // Query published designers directly
  const whereClause: Record<string, unknown> = {
    role: { in: ['DESIGNER', 'ARCHITECT', 'BUILDER'] },
    accountStatus: 'APPROVED',
    designerProjects: {
      some: { isPublic: true, publishedAt: { not: null } },
    },
  };

  if (region) {
    whereClause.location = { contains: region, mode: 'insensitive' };
  }

  if (bookmarkedOnly) {
    whereClause.id = { in: Array.from(bookmarkedIds) };
  }

  // Vendor lens: only show designers who have tagged this vendor's products
  if (specifyingMyProducts && vendorOrgId) {
    // Find designers who have tagged products from this vendor org
    const vendorProducts = await prisma.product.findMany({
      where: { vendorId: { not: null } },
      select: { id: true, vendorId: true },
    });

    // Get designer IDs who have tagged these products
    const taggedDesignerIds = await prisma.productTag.findMany({
      where: { productId: { in: vendorProducts.map(p => p.id) } },
      select: { image: { select: { project: { select: { designerId: true } } } } },
    });

    const designerIds = new Set(
      taggedDesignerIds
        .map(t => t.image?.project?.designerId)
        .filter((id): id is string => !!id)
    );

    if (designerIds.size > 0) {
      whereClause.id = { in: Array.from(designerIds) };
    }
  }

  // Determine order
  let orderBy: Record<string, string> = {};
  switch (effectiveSort) {
    case 'alpha':
      orderBy = { name: 'asc' };
      break;
    case 'projects':
      // Can't directly order by relation count in Prisma, so we'll sort post-query
      orderBy = { updatedAt: 'desc' };
      break;
    case 'recent':
    default:
      orderBy = { updatedAt: 'desc' };
      break;
  }

  const total = await prisma.user.count({ where: whereClause });

  const users = await prisma.user.findMany({
    where: whereClause,
    orderBy,
    skip,
    take: limit,
    select: {
      id: true,
      name: true,
      profileImage: true,
      location: true,
      title: true,
      bio: true,
      role: true,
      followers: true,
      updatedAt: true,
      designerProjects: {
        where: { isPublic: true, publishedAt: { not: null } },
        select: {
          id: true,
          title: true,
          saves: true,
          images: {
            take: 1,
            orderBy: { displayOrder: 'asc' },
            select: { url: true },
          },
        },
        orderBy: { saves: 'desc' },
      },
    },
  });

  let designers: DirectoryDesigner[] = users.map(user => {
    const projectCount = user.designerProjects?.length ?? 0;
    const totalSaves = user.designerProjects?.reduce((sum, p) => sum + p.saves, 0) ?? 0;
    const featuredProject = user.designerProjects?.[0];

    return {
      rank: 0, // No rank in browse mode
      rankChange: 0,
      user: {
        id: user.id,
        name: user.name,
        profileImage: user.profileImage,
        location: user.location,
        title: user.title,
        bio: user.bio,
        role: user.role,
      },
      stats: {
        projectCount,
        totalSaves,
        followerCount: user.followers,
      },
      featuredProject: featuredProject
        ? {
            id: featuredProject.id,
            title: featuredProject.title,
            heroImage: featuredProject.images[0]?.url ?? null,
          }
        : undefined,
      isBookmarked: bookmarkedIds.has(user.id),
    };
  });

  // Post-query sort for 'projects' mode
  if (effectiveSort === 'projects') {
    designers.sort((a, b) => b.stats.projectCount - a.stats.projectCount);
  }

  const response: DirectoryListResponse<DirectoryDesigner> = {
    items: designers,
    pagination: { page, limit, total, hasMore: skip + designers.length < total },
    lastUpdated: new Date(),
  };

  return NextResponse.json(response);
}
