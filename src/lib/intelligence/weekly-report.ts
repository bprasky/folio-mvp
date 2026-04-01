/**
 * Weekly Intelligence Report Generator
 *
 * Aggregates ActionItemSignals into a structured report covering:
 * - Volume metrics (quotes, samples, availability checks)
 * - Top requested products
 * - Vendor response metrics
 * - Emerging patterns and trends
 */

import { prisma } from '@/lib/prisma';

export interface WeeklyReport {
  period: { start: string; end: string };
  volume: {
    quoteRequests: number;
    sampleRequests: number;
    availabilityChecks: number;
    leadTimeRequests: number;
    bulkQuoteRequests: number;
    totalSignals: number;
  };
  topProducts: Array<{
    productId: string;
    productName: string;
    vendorName: string;
    signalCount: number;
  }>;
  vendorMetrics: Array<{
    vendorName: string;
    totalRequests: number;
    avgResponseHours: number | null;
    offPlatformRate: number;
  }>;
  trends: {
    topCategories: Array<{ category: string; count: number; changePercent: number }>;
    geoHotspots: Array<{ location: string; count: number }>;
    offPlatformRate: number;
  };
}

/**
 * Generate a weekly intelligence report for the given date range.
 * Defaults to the past 7 days.
 */
export async function generateWeeklyReport(
  startDate?: Date,
  endDate?: Date
): Promise<WeeklyReport> {
  const end = endDate || new Date();
  const start = startDate || new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
  const prevStart = new Date(start.getTime() - 7 * 24 * 60 * 60 * 1000);

  const where = {
    createdAt: { gte: start, lte: end },
  };

  // Volume by action type
  const volumeByType = await prisma.actionItemSignal.groupBy({
    by: ['actionType'],
    where,
    _count: { id: true },
  });

  const volumeMap = new Map(volumeByType.map(v => [v.actionType, v._count.id]));

  const volume = {
    quoteRequests: volumeMap.get('QUOTE_REQUEST') || 0,
    sampleRequests: volumeMap.get('SAMPLE_REQUEST') || 0,
    availabilityChecks: volumeMap.get('AVAILABILITY_CHECK') || 0,
    leadTimeRequests: volumeMap.get('LEAD_TIME_REQUEST') || 0,
    bulkQuoteRequests: volumeMap.get('BULK_QUOTE_REQUEST') || 0,
    totalSignals: volumeByType.reduce((sum, v) => sum + v._count.id, 0),
  };

  // Top products by signal count
  const topProductSignals = await prisma.actionItemSignal.groupBy({
    by: ['productId'],
    where,
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
    take: 20,
  });

  const productIds = topProductSignals.map(t => t.productId);
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, name: true, brand: true },
  });
  const productMap = new Map(products.map(p => [p.id, p]));

  const topProducts = topProductSignals.map(t => {
    const product = productMap.get(t.productId);
    return {
      productId: t.productId,
      productName: product?.name || 'Unknown',
      vendorName: product?.brand || 'Unknown',
      signalCount: t._count.id,
    };
  });

  // Vendor metrics — aggregate by vendor org
  const vendorSignals = await prisma.actionItemSignal.groupBy({
    by: ['vendorOrgId'],
    where: { ...where, vendorOrgId: { not: null } },
    _count: { id: true },
  });

  const vendorOrgIds = vendorSignals
    .map(v => v.vendorOrgId)
    .filter((id): id is string => id !== null);

  const vendorOrgs = await prisma.organization.findMany({
    where: { id: { in: vendorOrgIds } },
    select: { id: true, name: true },
  });
  const orgNameMap = new Map(vendorOrgs.map(o => [o.id, o.name]));

  // Response time: average hours between signal creation and a RESPONDED resolution
  const vendorMetrics = await Promise.all(
    vendorSignals.slice(0, 20).map(async (v) => {
      const offPlatformCount = await prisma.actionItemSignal.count({
        where: { ...where, vendorOrgId: v.vendorOrgId, isOffPlatform: true },
      });

      const responseSignals = await prisma.actionItemSignal.findMany({
        where: {
          ...where,
          vendorOrgId: v.vendorOrgId,
          responseTime: { not: null },
        },
        select: { responseTime: true },
      });

      const avgResponse = responseSignals.length > 0
        ? responseSignals.reduce((sum, s) => sum + (s.responseTime || 0), 0) / responseSignals.length
        : null;

      return {
        vendorName: orgNameMap.get(v.vendorOrgId!) || 'Unknown',
        totalRequests: v._count.id,
        avgResponseHours: avgResponse,
        offPlatformRate: v._count.id > 0 ? offPlatformCount / v._count.id : 0,
      };
    })
  );

  // Trends: top categories (from product tags)
  // Compare current week to previous week
  const currentCategoryCounts = await prisma.$queryRaw<Array<{ category: string; count: bigint }>>`
    SELECT p.category, COUNT(*) as count
    FROM action_item_signals s
    JOIN products p ON p.id = s."productId"
    WHERE s."createdAt" >= ${start} AND s."createdAt" <= ${end}
      AND p.category IS NOT NULL
    GROUP BY p.category
    ORDER BY count DESC
    LIMIT 10
  `;

  const prevCategoryCounts = await prisma.$queryRaw<Array<{ category: string; count: bigint }>>`
    SELECT p.category, COUNT(*) as count
    FROM action_item_signals s
    JOIN products p ON p.id = s."productId"
    WHERE s."createdAt" >= ${prevStart} AND s."createdAt" < ${start}
      AND p.category IS NOT NULL
    GROUP BY p.category
  `;

  const prevCatMap = new Map(prevCategoryCounts.map(c => [c.category, Number(c.count)]));

  const topCategories = currentCategoryCounts.map(c => {
    const current = Number(c.count);
    const prev = prevCatMap.get(c.category) || 0;
    const changePercent = prev > 0 ? Math.round(((current - prev) / prev) * 100) : 100;
    return { category: c.category, count: current, changePercent };
  });

  // Geo hotspots
  const geoSignals = await prisma.actionItemSignal.groupBy({
    by: ['location'],
    where: { ...where, location: { not: null } },
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
    take: 10,
  });

  const geoHotspots = geoSignals
    .filter(g => g.location)
    .map(g => ({ location: g.location!, count: g._count.id }));

  // Off-platform rate
  const totalOffPlatform = await prisma.actionItemSignal.count({
    where: { ...where, isOffPlatform: true },
  });
  const offPlatformRate = volume.totalSignals > 0 ? totalOffPlatform / volume.totalSignals : 0;

  return {
    period: { start: start.toISOString(), end: end.toISOString() },
    volume,
    topProducts,
    vendorMetrics: vendorMetrics.sort((a, b) => b.totalRequests - a.totalRequests),
    trends: {
      topCategories,
      geoHotspots,
      offPlatformRate,
    },
  };
}
