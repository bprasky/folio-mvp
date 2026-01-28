export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/vendor/shop-analytics
 * Fetch shop analytics for vendor organization
 *
 * Query params:
 * - organizationId: string (required) - Vendor organization ID
 * - timeRange: '7d' | '30d' | '90d' | 'all' (default '30d')
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organizationId');
    const timeRange = searchParams.get('timeRange') || '30d';

    if (!organizationId) {
      return NextResponse.json(
        { error: 'organizationId is required' },
        { status: 400 }
      );
    }

    // Verify user is member of organization
    const membership = await prisma.organizationUser.findFirst({
      where: {
        userId: session.user.id,
        organizationId,
        isActive: true,
      },
    });

    if (!membership) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Calculate date filter
    const now = new Date();
    let startDate: Date | null = null;
    switch (timeRange) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case 'all':
      default:
        startDate = null;
    }

    // Get all products for this vendor organization
    const vendorProducts = await prisma.product.findMany({
      where: { vendorId: organizationId },
      select: { id: true },
    });
    const productIds = vendorProducts.map((p) => p.id);

    if (productIds.length === 0) {
      return NextResponse.json({
        overview: {
          totalProducts: 0,
          productsInShops: 0,
          uniqueDesigners: 0,
          totalTestimonials: 0,
        },
        boosts: {
          total: 0,
          pending: 0,
          approved: 0,
          declined: 0,
          totalInvestment: 0,
        },
        topProducts: [],
        topDesigners: [],
        recentActivity: [],
      });
    }

    // Get shop products for vendor's products
    const shopProductsFilter = {
      productId: { in: productIds },
      isActive: true,
      ...(startDate && { createdAt: { gte: startDate } }),
    };

    const [
      shopProductCount,
      uniqueDesignerCount,
      testimonialCount,
      boostStats,
      topProducts,
      topDesigners,
      recentShopProducts,
    ] = await Promise.all([
      // Count shop products
      prisma.shopProduct.count({
        where: shopProductsFilter,
      }),

      // Count unique designers
      prisma.shopProduct.groupBy({
        by: ['designerId'],
        where: shopProductsFilter,
      }),

      // Count testimonials
      prisma.productTestimonial.count({
        where: {
          productId: { in: productIds },
          ...(startDate && { createdAt: { gte: startDate } }),
        },
      }),

      // Boost statistics
      prisma.shopBoost.groupBy({
        by: ['status'],
        where: {
          vendorId: organizationId,
          ...(startDate && { createdAt: { gte: startDate } }),
        },
        _count: true,
        _sum: { vendorCost: true },
      }),

      // Top products by shop count
      prisma.shopProduct.groupBy({
        by: ['productId'],
        where: shopProductsFilter,
        _count: true,
        orderBy: { _count: { productId: 'desc' } },
        take: 10,
      }),

      // Top designers by product count
      prisma.shopProduct.groupBy({
        by: ['designerId'],
        where: shopProductsFilter,
        _count: true,
        orderBy: { _count: { designerId: 'desc' } },
        take: 10,
      }),

      // Recent shop product additions
      prisma.shopProduct.findMany({
        where: {
          productId: { in: productIds },
          isActive: true,
        },
        include: {
          designer: {
            select: {
              id: true,
              name: true,
              profileImage: true,
            },
          },
          product: {
            select: {
              id: true,
              name: true,
              imageUrl: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ]);

    // Calculate boost totals
    const boostTotals = {
      total: boostStats.reduce((sum, s) => sum + s._count, 0),
      pending: boostStats.find((s) => s.status === 'PENDING')?._count || 0,
      approved: boostStats.find((s) => s.status === 'APPROVED')?._count || 0,
      declined: boostStats.find((s) => s.status === 'DECLINED')?._count || 0,
      totalInvestment: boostStats.reduce(
        (sum, s) => sum + (Number(s._sum.vendorCost) || 0),
        0
      ),
    };

    // Enrich top products with details
    const topProductIds = topProducts.map((p) => p.productId);
    const productDetails = await prisma.product.findMany({
      where: { id: { in: topProductIds } },
      select: {
        id: true,
        name: true,
        imageUrl: true,
        category: true,
      },
    });
    const productMap = new Map(productDetails.map((p) => [p.id, p]));

    const enrichedTopProducts = topProducts.map((tp) => ({
      product: productMap.get(tp.productId),
      shopCount: tp._count,
    }));

    // Enrich top designers with details
    const topDesignerIds = topDesigners.map((d) => d.designerId);
    const designerDetails = await prisma.user.findMany({
      where: { id: { in: topDesignerIds } },
      select: {
        id: true,
        name: true,
        profileImage: true,
        companyName: true,
      },
    });
    const designerMap = new Map(designerDetails.map((d) => [d.id, d]));

    const enrichedTopDesigners = topDesigners.map((td) => ({
      designer: designerMap.get(td.designerId),
      productCount: td._count,
    }));

    // Format recent activity
    const recentActivity = recentShopProducts.map((sp) => ({
      id: sp.id,
      type: 'shop_add' as const,
      designer: sp.designer,
      product: sp.product,
      hasQuote: !!sp.quote,
      createdAt: sp.createdAt,
    }));

    return NextResponse.json({
      overview: {
        totalProducts: productIds.length,
        productsInShops: shopProductCount,
        uniqueDesigners: uniqueDesignerCount.length,
        totalTestimonials: testimonialCount,
      },
      boosts: boostTotals,
      topProducts: enrichedTopProducts,
      topDesigners: enrichedTopDesigners,
      recentActivity,
      timeRange,
    });
  } catch (error) {
    console.error('[vendor/shop-analytics] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch shop analytics' },
      { status: 500 }
    );
  }
}
