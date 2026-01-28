export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/vendor/trigger-tag
 *
 * Returns the specific tag that triggered this vendor's invite,
 * used for the personalized hook in the scroll presentation.
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

    // Get the vendor invite with trigger tag
    const vendorInvite = await prisma.vendorInvite.findUnique({
      where: { organizationId: orgUser.organizationId },
      include: {
        triggerTag: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                imageUrl: true,
                brand: true,
                price: true,
              },
            },
            image: {
              select: {
                id: true,
                url: true,
                project: {
                  select: {
                    id: true,
                    title: true,
                    designer: {
                      select: {
                        id: true,
                        name: true,
                        profileImage: true,
                        companyName: true,
                        followers: true,
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

    if (!vendorInvite?.triggerTag) {
      return NextResponse.json({ triggerTag: null });
    }

    const tag = vendorInvite.triggerTag;
    const designer = tag.image?.project?.designer;

    // Check for quote
    let quote: string | null = null;
    if (designer) {
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

    return NextResponse.json({
      triggerTag: {
        product: tag.product,
        projectImage: tag.image?.url ?? null,
        project: tag.image?.project
          ? {
              id: tag.image.project.id,
              title: tag.image.project.title,
            }
          : null,
        designer: designer
          ? {
              id: designer.id,
              name: designer.name,
              profileImage: designer.profileImage,
              companyName: designer.companyName,
              followerCount: designer.followers || 0,
            }
          : null,
        quote,
        taggedAt: tag.createdAt,
      },
    });
  } catch (error) {
    console.error('[vendor/trigger-tag] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
