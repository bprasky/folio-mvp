export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/vendor/invite-stats
 *
 * Returns live vendor statistics for the organization,
 * including product tags, unique designers, project features, etc.
 * Gated: before admin activation, designer identities are omitted.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Get user's vendor organization
    const orgUser = await prisma.organizationUser.findFirst({
      where: {
        userId: session.user.id,
        isActive: true,
        organization: {
          type: { in: ['VENDOR', 'MANUFACTURER', 'SHOWROOM'] },
        },
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            isFoundingVendor: true,
          },
        },
      },
    });

    if (!orgUser) {
      return NextResponse.json({ error: 'No vendor organization found' }, { status: 404 });
    }

    const orgId = orgUser.organization.id;

    // Check admin activation status
    const vendorInvite = await prisma.vendorInvite.findUnique({
      where: { organizationId: orgId },
      select: { adminActivatedAt: true, claimedAt: true },
    });

    const isAdminActivated = !!vendorInvite?.adminActivatedAt;

    // Get all org member user IDs (for vendor product lookup)
    const orgMembers = await prisma.organizationUser.findMany({
      where: { organizationId: orgId, isActive: true },
      select: { userId: true },
    });
    const memberUserIds = orgMembers.map((m) => m.userId);

    // Count products tagged by designers (via ProductTag -> Product -> vendorId)
    const productsTagged = await prisma.productTag.count({
      where: {
        product: {
          vendorId: { in: memberUserIds },
        },
      },
    });

    // Count unique designers who tagged vendor products
    // ProductTag -> image -> ProjectImage -> Project -> designerId
    const designerTags = await prisma.productTag.findMany({
      where: {
        product: {
          vendorId: { in: memberUserIds },
        },
      },
      select: {
        image: {
          select: {
            project: {
              select: {
                designerId: true,
              },
            },
          },
        },
      },
    });

    const uniqueDesignerIds = new Set(
      designerTags
        .map((t) => t.image?.project?.designerId)
        .filter(Boolean) as string[]
    );
    const uniqueDesigners = uniqueDesignerIds.size;

    // Count projects featuring vendor products
    const projectIds = new Set(
      designerTags
        .map((t) => t.image?.project)
        .filter(Boolean)
        .map((p) => p!.designerId) // project ref
    );
    // Actually get unique project IDs properly
    const projectTags = await prisma.productTag.findMany({
      where: {
        product: {
          vendorId: { in: memberUserIds },
        },
      },
      select: {
        image: {
          select: {
            projectId: true,
          },
        },
      },
    });
    const uniqueProjectIds = new Set(
      projectTags.map((t) => t.image?.projectId).filter(Boolean) as string[]
    );
    const projectsFeaturedIn = uniqueProjectIds.size;

    // Designer reach: combined follower count of designers who tagged
    let designerReach = 0;
    if (uniqueDesignerIds.size > 0) {
      const designers = await prisma.user.findMany({
        where: { id: { in: Array.from(uniqueDesignerIds) } },
        select: { followers: true },
      });
      designerReach = designers.reduce((sum, d) => sum + (d.followers || 0), 0);
    }

    // Team members on Folio
    const teamMembersOnFolio = orgMembers.length;

    // Reps who have claimed tags (org users with MEMBER role or above)
    const repsClaimedTags = await prisma.organizationUser.count({
      where: {
        organizationId: orgId,
        isActive: true,
        role: { in: ['MEMBER', 'MANAGER', 'ADMIN', 'OWNER'] },
      },
    });

    return NextResponse.json({
      productsTagged,
      uniqueDesigners,
      projectsFeaturedIn,
      designerReach,
      teamMembersOnFolio,
      repsClaimedTags,
      isAdminActivated,
      isFoundingVendor: orgUser.organization.isFoundingVendor,
    });
  } catch (error) {
    console.error('[vendor/invite-stats] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
