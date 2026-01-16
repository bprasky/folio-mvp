export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { DirectoryDesigner, DirectoryListResponse } from '@/lib/directory/types';

/**
 * GET /api/directory/designers
 * List designers in the directory with optional filtering
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Parse query parameters
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)));
    const style = searchParams.get('style') || undefined;
    const region = searchParams.get('region') || undefined;
    const view = (searchParams.get('view') || 'overall') as 'overall' | 'rising';

    const skip = (page - 1) * limit;

    // Build where clause
    const whereClause: Record<string, unknown> = {
      rankingType: 'DESIGNER',
      isEligible: true,
      isVisible: true,
      rank: { not: null },
    };

    // For rising view, only show designers with positive rank change
    if (view === 'rising') {
      whereClause.rankChange = { gt: 0 };
    }

    // Get total count
    const total = await prisma.directoryRanking.count({
      where: whereClause,
    });

    // Get rankings with user data
    const rankings = await prisma.directoryRanking.findMany({
      where: whereClause,
      orderBy: view === 'rising' ? { rankChange: 'desc' } : { rank: 'asc' },
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
            followers: true,
            designerProjects: {
              where: {
                isPublic: true,
                publishedAt: { not: null },
              },
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

    // Apply region filter on user location (post-query filter for simplicity)
    let filteredRankings = rankings;
    if (region) {
      const regionLower = region.toLowerCase();
      filteredRankings = rankings.filter(
        (r) =>
          r.user?.location?.toLowerCase().includes(regionLower) ?? false
      );
    }

    // Transform to response format
    const designers: DirectoryDesigner[] = filteredRankings
      .filter((r) => r.user)
      .map((r) => {
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
        };
      });

    const response: DirectoryListResponse<DirectoryDesigner> = {
      items: designers,
      pagination: {
        page,
        limit,
        total,
        hasMore: skip + designers.length < total,
      },
      lastUpdated: new Date(),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[API] /api/directory/designers error:', error);
    return NextResponse.json({ error: 'Failed to fetch directory' }, { status: 500 });
  }
}
