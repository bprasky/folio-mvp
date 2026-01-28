export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/vendor/designers
 *
 * Returns designers who have tagged this vendor's products.
 * Gated: only returns full details if org is admin-activated.
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
      select: { organizationId: true },
    });

    if (!orgUser) {
      return NextResponse.json({ error: 'No vendor organization found' }, { status: 404 });
    }

    const orgId = orgUser.organizationId;

    // Check admin activation
    const vendorInvite = await prisma.vendorInvite.findUnique({
      where: { organizationId: orgId },
      select: { adminActivatedAt: true },
    });

    const isAdminActivated = !!vendorInvite?.adminActivatedAt;

    // Get all org member user IDs
    const orgMembers = await prisma.organizationUser.findMany({
      where: { organizationId: orgId, isActive: true },
      select: { userId: true },
    });
    const memberUserIds = orgMembers.map((m) => m.userId);

    // Find product tags linked to this vendor's products, with project + designer info
    const tags = await prisma.productTag.findMany({
      where: {
        product: {
          vendorId: { in: memberUserIds },
        },
      },
      include: {
        product: {
          select: { id: true, name: true },
        },
        image: {
          select: {
            project: {
              select: {
                id: true,
                title: true,
                designerId: true,
                designer: {
                  select: {
                    id: true,
                    name: true,
                    profileImage: true,
                    location: true,
                    followers: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Group by designer
    const designerMap = new Map<string, {
      id: string;
      name: string;
      profileImage: string | null;
      location: string | null;
      followerCount: number;
      tags: {
        productName: string;
        projectName: string;
        projectId: string;
        quote: string | null;
        taggedAt: Date;
      }[];
    }>();

    for (const tag of tags) {
      const designer = tag.image?.project?.designer;
      const project = tag.image?.project;
      if (!designer || !project) continue;

      if (!designerMap.has(designer.id)) {
        designerMap.set(designer.id, {
          id: designer.id,
          name: isAdminActivated ? designer.name : `Designer ${designerMap.size + 1}`,
          profileImage: isAdminActivated ? designer.profileImage : null,
          location: isAdminActivated ? designer.location : null,
          followerCount: designer.followers || 0,
          tags: [],
        });
      }

      const entry = designerMap.get(designer.id)!;

      // Check for quotes from ShopProduct
      let quote: string | null = null;
      if (isAdminActivated) {
        const shopProduct = await prisma.shopProduct.findUnique({
          where: {
            designerId_productId: {
              designerId: designer.id,
              productId: tag.product.id,
            },
          },
          select: { quote: true },
        });
        quote = shopProduct?.quote ?? null;
      }

      entry.tags.push({
        productName: tag.product.name,
        projectName: project.title || 'Untitled Project',
        projectId: project.id,
        quote,
        taggedAt: tag.createdAt,
      });
    }

    // Count projects per designer
    const designers = Array.from(designerMap.values()).map((d) => ({
      ...d,
      projectCount: new Set(d.tags.map((t) => t.projectId)).size,
    }));

    return NextResponse.json({
      designers,
      isAdminActivated,
    });
  } catch (error) {
    console.error('[vendor/designers] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
