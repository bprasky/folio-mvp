export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/designer/shop
 * Get designer's shop dashboard data
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const designerId = session.user.id;

    // Get all shop products
    const shopProducts = await prisma.shopProduct.findMany({
      where: { designerId },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            imageUrl: true,
            brand: true,
          },
        },
        boosts: {
          where: {
            status: { in: ['PENDING', 'ACTIVE'] },
          },
          include: {
            vendor: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      orderBy: [
        { isFeatured: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    // Get pending boosts for this designer
    const pendingBoosts = await prisma.shopBoost.findMany({
      where: {
        status: 'PENDING',
        shopProduct: {
          designerId,
        },
      },
      include: {
        shopProduct: {
          include: {
            product: {
              select: {
                name: true,
              },
            },
          },
        },
        vendor: {
          select: {
            name: true,
          },
        },
      },
    });

    // Calculate stats
    const totalProducts = shopProducts.filter(p => p.isActive).length;
    const productsNeedingQuotes = shopProducts.filter(p => p.isActive && !p.quote).length;

    // Get earnings this month (from completed/active boosts)
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const monthlyEarnings = await prisma.shopBoost.aggregate({
      _sum: {
        designerCredit: true,
      },
      where: {
        shopProduct: {
          designerId,
        },
        status: 'ACTIVE',
        approvedAt: {
          gte: startOfMonth,
        },
      },
    });

    // Format products for response
    const products = shopProducts.map(sp => {
      const activeBoost = sp.boosts.find(b => b.status === 'ACTIVE');
      const pendingBoost = sp.boosts.find(b => b.status === 'PENDING');

      return {
        id: sp.id,
        productId: sp.productId,
        quote: sp.quote,
        isFeatured: sp.isFeatured,
        isActive: sp.isActive,
        product: sp.product,
        views: 0, // TODO: Add analytics tracking
        saves: 0, // TODO: Add analytics tracking
        boostStatus: activeBoost ? 'BOOSTED' as const : pendingBoost ? 'PENDING' as const : null,
      };
    });

    // Format pending boosts for response
    const formattedPendingBoosts = pendingBoosts.map(boost => ({
      id: boost.id,
      shopProductId: boost.shopProductId,
      vendorName: boost.vendor.name,
      productName: boost.shopProduct.product.name,
      startDate: boost.startDate.toISOString(),
      endDate: boost.endDate.toISOString(),
      designerCredit: Number(boost.designerCredit),
    }));

    return NextResponse.json({
      stats: {
        totalProducts,
        viewsThisMonth: 0, // TODO: Add analytics tracking
        earningsThisMonth: Number(monthlyEarnings._sum.designerCredit || 0),
        productsNeedingQuotes,
        pendingBoosts: pendingBoosts.length,
      },
      products,
      pendingBoosts: formattedPendingBoosts,
    });
  } catch (error) {
    console.error('[designer/shop] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch shop data' },
      { status: 500 }
    );
  }
}
