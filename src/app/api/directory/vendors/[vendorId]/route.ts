export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import {
  calculateVendorScores,
  calculateVendorTotalScore,
  getVendorEligibilityStatus,
  updateVendorRanking,
} from '@/lib/directory';

interface VendorRankingResponse {
  rank: number | null;
  rankChange: number;
  totalScore: number;
  isEligible: boolean;
  requiresProfessionalUpgrade: boolean;
  stats: {
    designersTagging: number;
    projectsIncluded: number;
    totalProductSaves: number;
    catalogSize: number;
  };
  breakdown?: {
    designerTagsScore: number;
    projectInclusionScore: number;
    saveScore: number;
    catalogCompletenessScore: number;
  };
}

/**
 * GET /api/directory/vendors/[vendorId]
 * Get individual vendor's ranking and score breakdown
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ vendorId: string }> }
) {
  try {
    const { vendorId } = await params;
    const session = await getServerSession(authOptions);

    // Check if user is part of this vendor org
    let isOwnOrg = false;
    if (session?.user?.id) {
      const membership = await prisma.organizationUser.findFirst({
        where: {
          userId: session.user.id,
          organizationId: vendorId,
        },
      });
      isOwnOrg = !!membership;
    }

    // Get current ranking
    const ranking = await prisma.directoryRanking.findUnique({
      where: { vendorOrgId: vendorId },
      select: {
        rank: true,
        rankChange: true,
        totalScore: true,
        designerTagsScore: true,
        projectInclusionScore: true,
        saveScore: true,
        catalogCompletenessScore: true,
        isEligible: true,
        lastCalculatedAt: true,
      },
    });

    // Get eligibility status
    const eligibility = await getVendorEligibilityStatus(vendorId);

    // Calculate stats
    const orgUsers = await prisma.organizationUser.findMany({
      where: { organizationId: vendorId },
      select: { userId: true },
    });
    const userIds = orgUsers.map((ou) => ou.userId);

    const products = await prisma.product.findMany({
      where: { vendorId: { in: userIds } },
      include: {
        tags: {
          include: {
            image: {
              select: {
                project: {
                  select: {
                    id: true,
                    designerId: true,
                    saves: true,
                    isPublic: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    const designersTagging = new Set<string>();
    const projectsIncluded = new Set<string>();
    let totalProductSaves = 0;

    for (const product of products) {
      for (const tag of product.tags) {
        if (tag.image?.project?.designerId) {
          designersTagging.add(tag.image.project.designerId);
        }
        if (tag.image?.project?.id && tag.image.project.isPublic) {
          projectsIncluded.add(tag.image.project.id);
          totalProductSaves += tag.image.project.saves;
        }
      }
    }

    const stats = {
      designersTagging: designersTagging.size,
      projectsIncluded: projectsIncluded.size,
      totalProductSaves,
      catalogSize: products.length,
    };

    let response: VendorRankingResponse;

    if (ranking) {
      response = {
        rank: ranking.rank,
        rankChange: ranking.rankChange,
        totalScore: ranking.totalScore,
        isEligible: ranking.isEligible,
        requiresProfessionalUpgrade: eligibility.requiresProfessionalUpgrade,
        stats,
      };

      // Only show breakdown to org members
      if (isOwnOrg) {
        response.breakdown = {
          designerTagsScore: ranking.designerTagsScore,
          projectInclusionScore: ranking.projectInclusionScore,
          saveScore: ranking.saveScore,
          catalogCompletenessScore: ranking.catalogCompletenessScore,
        };
      }
    } else {
      // Calculate scores on-the-fly
      const scores = await calculateVendorScores(vendorId);
      const totalScore = calculateVendorTotalScore(scores);

      response = {
        rank: null,
        rankChange: 0,
        totalScore,
        isEligible: eligibility.isEligible,
        requiresProfessionalUpgrade: eligibility.requiresProfessionalUpgrade,
        stats,
      };

      if (isOwnOrg) {
        response.breakdown = scores;
      }
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('[API] /api/directory/vendors/[vendorId] error:', error);
    return NextResponse.json({ error: 'Failed to fetch ranking' }, { status: 500 });
  }
}

/**
 * POST /api/directory/vendors/[vendorId]
 * Trigger ranking recalculation for a vendor
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ vendorId: string }> }
) {
  try {
    const { vendorId } = await params;
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin of this vendor org or platform admin
    const isAdmin = session.user.role === 'ADMIN';
    const membership = await prisma.organizationUser.findFirst({
      where: {
        userId: session.user.id,
        organizationId: vendorId,
        role: { in: ['OWNER', 'ADMIN'] },
      },
    });

    if (!isAdmin && !membership) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Trigger ranking update
    const result = await updateVendorRanking(vendorId);

    return NextResponse.json({
      success: result.success,
      rank: result.rank,
      rankChange: result.rankChange,
    });
  } catch (error) {
    console.error('[API] POST /api/directory/vendors/[vendorId] error:', error);
    return NextResponse.json({ error: 'Failed to update ranking' }, { status: 500 });
  }
}
