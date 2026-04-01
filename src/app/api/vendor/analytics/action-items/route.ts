export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/vendor/analytics/action-items
 * Action items analytics for vendor dashboard.
 * Returns quote volume, response metrics, top requested products, demand trends.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Find vendor org for this user
    const membership = await prisma.organizationUser.findFirst({
      where: {
        userId: session.user.id,
        isActive: true,
        organization: { type: { in: ['VENDOR', 'MANUFACTURER', 'SHOWROOM'] } },
      },
      select: { organizationId: true, organization: { select: { name: true } } },
    });

    if (!membership) {
      return NextResponse.json({ error: 'No vendor org found' }, { status: 404 });
    }

    const vendorOrgId = membership.organizationId;
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    // Current period signals
    const currentSignals = await prisma.actionItemSignal.findMany({
      where: { vendorOrgId, createdAt: { gte: thirtyDaysAgo } },
      select: { actionType: true, productId: true, quantity: true, isOffPlatform: true, responseTime: true, convertedToOrder: true, designerOrgId: true },
    });

    // Previous period for comparison
    const previousCount = await prisma.actionItemSignal.count({
      where: { vendorOrgId, createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } },
    });

    // Volume by type
    const volumeByType: Record<string, number> = {};
    let totalOffPlatform = 0;
    const designerIds = new Set<string>();
    const responseTimes: number[] = [];

    for (const s of currentSignals) {
      volumeByType[s.actionType] = (volumeByType[s.actionType] || 0) + 1;
      if (s.isOffPlatform) totalOffPlatform++;
      designerIds.add(s.designerOrgId);
      if (s.responseTime) responseTimes.push(s.responseTime);
    }

    const avgResponseHours = responseTimes.length > 0
      ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length * 10) / 10
      : null;

    // Top requested products
    const productCounts = new Map<string, number>();
    for (const s of currentSignals) {
      productCounts.set(s.productId, (productCounts.get(s.productId) || 0) + 1);
    }
    const topProductIds = Array.from(productCounts.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([id]) => id);

    const topProducts = await prisma.product.findMany({
      where: { id: { in: topProductIds } },
      select: { id: true, name: true, category: true },
    });

    const topProductsWithCounts = topProductIds.map(id => {
      const product = topProducts.find(p => p.id === id);
      return {
        productId: id,
        productName: product?.name || 'Unknown',
        category: product?.category || null,
        requestCount: productCounts.get(id) || 0,
      };
    });

    // Shadow profile data (if exists)
    let shadowProfile = null;
    const shadow = await prisma.vendorShadowProfile.findFirst({
      where: { vendorOrgId },
      select: {
        totalProducts: true,
        totalProjects: true,
        totalDesigners: true,
        geoDistribution: true,
        projectTypeDist: true,
        topProducts: true,
      },
    });
    if (shadow) {
      shadowProfile = shadow;
    }

    const changePercent = previousCount > 0
      ? Math.round(((currentSignals.length - previousCount) / previousCount) * 100)
      : null;

    return NextResponse.json({
      period: { days: 30 },
      volume: {
        total: currentSignals.length,
        byType: volumeByType,
        changePercent,
        previousTotal: previousCount,
      },
      designers: {
        activeCount: designerIds.size,
      },
      response: {
        avgResponseHours,
        offPlatformRate: currentSignals.length > 0
          ? Math.round((totalOffPlatform / currentSignals.length) * 100)
          : 0,
      },
      topProducts: topProductsWithCounts,
      shadowProfile,
    });
  } catch (error) {
    console.error('[API] vendor action-items analytics error:', error);
    return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 });
  }
}
