export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { DirectoryVendor, DirectoryListResponse } from '@/lib/directory/types';

/**
 * GET /api/directory/vendors
 * List vendors in the directory with optional filtering
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Parse query parameters
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)));
    const category = searchParams.get('category') || undefined;
    const region = searchParams.get('region') || undefined;
    const sort = searchParams.get('sort') || 'ranked';
    const legacyView = searchParams.get('view');
    const view = legacyView === 'rising' ? 'rising' : (sort === 'rising' ? 'rising' : 'overall');

    const skip = (page - 1) * limit;

    // Build where clause
    const whereClause: Record<string, unknown> = {
      rankingType: 'VENDOR',
      isEligible: true,
      isVisible: true,
      rank: { not: null },
    };

    // For rising view, only show vendors with positive rank change
    if (view === 'rising') {
      whereClause.rankChange = { gt: 0 };
    }

    // Get total count
    const total = await prisma.directoryRanking.count({
      where: whereClause,
    });

    // Get rankings with organization data
    const rankings = await prisma.directoryRanking.findMany({
      where: whereClause,
      orderBy: view === 'rising' ? { rankChange: 'desc' } : { rank: 'asc' },
      skip,
      take: limit,
      include: {
        vendorOrg: {
          select: {
            id: true,
            name: true,
            logo: true,
            description: true,
            type: true,
            users: {
              select: {
                user: {
                  select: {
                    products: {
                      select: {
                        id: true,
                        tags: {
                          select: {
                            image: {
                              select: {
                                project: {
                                  select: {
                                    id: true,
                                    designerId: true,
                                    saves: true,
                                  },
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    // Transform to response format
    const vendors: DirectoryVendor[] = rankings
      .filter((r) => r.vendorOrg)
      .map((r) => {
        const org = r.vendorOrg!;

        // Calculate stats from products
        const allProducts = org.users.flatMap((ou) => ou.user.products);
        const designersTagging = new Set<string>();
        const projectsIncluded = new Set<string>();
        let totalProductSaves = 0;

        for (const product of allProducts) {
          for (const tag of product.tags) {
            if (tag.image?.project?.designerId) {
              designersTagging.add(tag.image.project.designerId);
            }
            if (tag.image?.project?.id) {
              projectsIncluded.add(tag.image.project.id);
              totalProductSaves += tag.image.project.saves;
            }
          }
        }

        return {
          rank: r.rank!,
          rankChange: r.rankChange,
          organization: {
            id: org.id,
            name: org.name,
            logo: org.logo,
            description: org.description,
            type: org.type,
          },
          stats: {
            designersTagging: designersTagging.size,
            projectsIncluded: projectsIncluded.size,
            totalProductSaves,
            catalogSize: allProducts.length,
          },
        };
      });

    const response: DirectoryListResponse<DirectoryVendor> = {
      items: vendors,
      pagination: {
        page,
        limit,
        total,
        hasMore: skip + vendors.length < total,
      },
      lastUpdated: new Date(),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[API] /api/directory/vendors error:', error);
    return NextResponse.json({ error: 'Failed to fetch directory' }, { status: 500 });
  }
}
