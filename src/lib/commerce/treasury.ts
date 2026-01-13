/**
 * Treasury and Float Management Utilities
 *
 * This module handles treasury metrics, float calculations,
 * and financial reporting for the Folio Credit system.
 */

import type { PrismaClient } from '@prisma/client';

export interface TreasuryMetrics {
  // Credit balances
  totalPendingCredits: number;      // Credits in hold period
  totalAvailableCredits: number;    // Credits available for spending
  totalOutstandingCredits: number;  // Total credits in circulation

  // Transaction volumes
  totalCreditEarned: number;        // Lifetime credits earned
  totalCreditRedeemed: number;      // Lifetime credits spent

  // Float economics
  estimatedFloatValue: number;      // Pending credits = float opportunity
  averageHoldDays: number;          // Average days credits are held

  // Order metrics
  totalOrders: number;
  totalRetailValue: number;
  totalTradeValue: number;
  totalMarginCaptured: number;

  // Credit allocation
  totalDesignerCredits: number;
  totalRepCredits: number;
  totalFolioRevenue: number;
  totalConsumerSavings: number;
}

/**
 * Get comprehensive treasury metrics for admin dashboard
 */
export async function getTreasuryMetrics(prisma: PrismaClient): Promise<TreasuryMetrics> {
  // Get aggregate credit account data
  const creditAggregates = await prisma.creditAccount.aggregate({
    _sum: {
      pendingBalance: true,
      availableBalance: true,
      lifetimeEarned: true,
      lifetimeRedeemed: true,
    },
  });

  // Get order aggregates
  const orderAggregates = await prisma.order.aggregate({
    _count: { id: true },
    _sum: {
      retailAmountCents: true,
      tradeAmountCents: true,
      marginAmountCents: true,
      designerCreditCents: true,
      repCreditCents: true,
      folioAmountCents: true,
      consumerDiscountCents: true,
    },
    where: {
      status: { notIn: ['CANCELLED', 'RETURNED'] },
    },
  });

  // Calculate average hold days from credit transactions
  const holdDaysResult = await prisma.$queryRaw<[{ avg_days: number }]>`
    SELECT AVG(
      EXTRACT(EPOCH FROM (COALESCE("processedAt", NOW()) - "createdAt")) / 86400
    ) as avg_days
    FROM "credit_transactions"
    WHERE type = 'EARN'
  `;

  const totalPendingCredits = Number(creditAggregates._sum.pendingBalance || 0);
  const totalAvailableCredits = Number(creditAggregates._sum.availableBalance || 0);

  return {
    // Credit balances
    totalPendingCredits,
    totalAvailableCredits,
    totalOutstandingCredits: totalPendingCredits + totalAvailableCredits,

    // Transaction volumes
    totalCreditEarned: Number(creditAggregates._sum.lifetimeEarned || 0),
    totalCreditRedeemed: Number(creditAggregates._sum.lifetimeRedeemed || 0),

    // Float economics
    estimatedFloatValue: totalPendingCredits, // Pending credits = investable float
    averageHoldDays: holdDaysResult?.[0]?.avg_days || 30,

    // Order metrics (convert cents to dollars)
    totalOrders: orderAggregates._count.id || 0,
    totalRetailValue: (orderAggregates._sum.retailAmountCents || 0) / 100,
    totalTradeValue: (orderAggregates._sum.tradeAmountCents || 0) / 100,
    totalMarginCaptured: (orderAggregates._sum.marginAmountCents || 0) / 100,

    // Credit allocation (convert cents to dollars)
    totalDesignerCredits: (orderAggregates._sum.designerCreditCents || 0) / 100,
    totalRepCredits: (orderAggregates._sum.repCreditCents || 0) / 100,
    totalFolioRevenue: (orderAggregates._sum.folioAmountCents || 0) / 100,
    totalConsumerSavings: (orderAggregates._sum.consumerDiscountCents || 0) / 100,
  };
}

export interface MonthlyTreasuryReport {
  month: string;          // YYYY-MM format
  ordersProcessed: number;
  retailVolume: number;
  tradeVolume: number;
  marginCaptured: number;
  creditsEarned: number;
  creditsRedeemed: number;
  creditsReleased: number;
  netFloatChange: number;
}

/**
 * Get monthly treasury report for a date range
 */
export async function getMonthlyTreasuryReports(
  prisma: PrismaClient,
  startDate: Date,
  endDate: Date
): Promise<MonthlyTreasuryReport[]> {
  // Get monthly order aggregates
  const ordersByMonth = await prisma.$queryRaw<Array<{
    month: string;
    order_count: number;
    retail_total: number;
    trade_total: number;
    margin_total: number;
  }>>`
    SELECT
      TO_CHAR("createdAt", 'YYYY-MM') as month,
      COUNT(*) as order_count,
      SUM("retailAmountCents") as retail_total,
      SUM("tradeAmountCents") as trade_total,
      SUM("marginAmountCents") as margin_total
    FROM "orders"
    WHERE "createdAt" >= ${startDate}
      AND "createdAt" <= ${endDate}
      AND status NOT IN ('CANCELLED', 'RETURNED')
    GROUP BY TO_CHAR("createdAt", 'YYYY-MM')
    ORDER BY month
  `;

  // Get monthly credit transactions
  const creditsByMonth = await prisma.$queryRaw<Array<{
    month: string;
    earned: number;
    redeemed: number;
    released: number;
  }>>`
    SELECT
      TO_CHAR("createdAt", 'YYYY-MM') as month,
      SUM(CASE WHEN type = 'EARN' THEN amount ELSE 0 END) as earned,
      SUM(CASE WHEN type = 'REDEEM' THEN ABS(amount) ELSE 0 END) as redeemed,
      SUM(CASE WHEN type = 'EARN' AND "processedAt" IS NOT NULL THEN amount ELSE 0 END) as released
    FROM "credit_transactions"
    WHERE "createdAt" >= ${startDate}
      AND "createdAt" <= ${endDate}
    GROUP BY TO_CHAR("createdAt", 'YYYY-MM')
    ORDER BY month
  `;

  // Combine data
  const creditsByMonthMap = new Map(
    creditsByMonth.map((c) => [c.month, c])
  );

  return ordersByMonth.map((o) => {
    const credits = creditsByMonthMap.get(o.month) || {
      earned: 0,
      redeemed: 0,
      released: 0,
    };

    const creditsEarned = Number(credits.earned);
    const creditsRedeemed = Number(credits.redeemed);
    const creditsReleased = Number(credits.released);

    return {
      month: o.month,
      ordersProcessed: Number(o.order_count),
      retailVolume: Number(o.retail_total) / 100,
      tradeVolume: Number(o.trade_total) / 100,
      marginCaptured: Number(o.margin_total) / 100,
      creditsEarned,
      creditsRedeemed,
      creditsReleased,
      netFloatChange: creditsEarned - creditsReleased,
    };
  });
}

export interface VendorPerformance {
  vendorOrgId: string;
  vendorName: string;
  orderCount: number;
  retailVolume: number;
  tradeVolume: number;
  marginGenerated: number;
  designerCreditsGenerated: number;
  repCreditsGenerated: number;
  averageOrderValue: number;
  averageDiscountPercent: number;
}

/**
 * Get vendor performance metrics for commerce analytics
 */
export async function getVendorPerformance(
  prisma: PrismaClient,
  options?: {
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }
): Promise<VendorPerformance[]> {
  const { startDate, endDate, limit = 20 } = options || {};

  const where: any = {
    status: { notIn: ['CANCELLED', 'RETURNED'] },
    vendorOrgId: { not: null },
  };

  if (startDate) where.createdAt = { gte: startDate };
  if (endDate) where.createdAt = { ...where.createdAt, lte: endDate };

  // Get orders grouped by vendor with aggregates
  const vendorOrders = await prisma.order.groupBy({
    by: ['vendorOrgId'],
    where,
    _count: { id: true },
    _sum: {
      retailAmountCents: true,
      tradeAmountCents: true,
      marginAmountCents: true,
      designerCreditCents: true,
      repCreditCents: true,
    },
    _avg: {
      retailAmountCents: true,
    },
    orderBy: {
      _sum: {
        retailAmountCents: 'desc',
      },
    },
    take: limit,
  });

  // Get vendor names
  const vendorIds = vendorOrders.map((v) => v.vendorOrgId).filter(Boolean) as string[];
  const vendors = await prisma.organization.findMany({
    where: { id: { in: vendorIds } },
    select: { id: true, name: true },
  });
  const vendorNameMap = new Map(vendors.map((v) => [v.id, v.name]));

  return vendorOrders.map((v) => {
    const retailTotal = v._sum.retailAmountCents || 0;
    const tradeTotal = v._sum.tradeAmountCents || 0;

    return {
      vendorOrgId: v.vendorOrgId!,
      vendorName: vendorNameMap.get(v.vendorOrgId!) || 'Unknown',
      orderCount: v._count.id,
      retailVolume: retailTotal / 100,
      tradeVolume: tradeTotal / 100,
      marginGenerated: (v._sum.marginAmountCents || 0) / 100,
      designerCreditsGenerated: (v._sum.designerCreditCents || 0) / 100,
      repCreditsGenerated: (v._sum.repCreditCents || 0) / 100,
      averageOrderValue: (v._avg.retailAmountCents || 0) / 100,
      averageDiscountPercent: retailTotal > 0
        ? ((retailTotal - tradeTotal) / retailTotal) * 100
        : 0,
    };
  });
}

export interface DesignerEarningsReport {
  designerId: string;
  designerName: string;
  designerEmail: string;
  totalCreditEarned: number;
  totalCreditRedeemed: number;
  pendingCredits: number;
  availableCredits: number;
  attributedOrderCount: number;
  attributedOrderValue: number;
}

/**
 * Get designer earnings report for admin visibility
 */
export async function getDesignerEarningsReport(
  prisma: PrismaClient,
  options?: {
    limit?: number;
    sortBy?: 'earned' | 'pending' | 'orders';
  }
): Promise<DesignerEarningsReport[]> {
  const { limit = 50, sortBy = 'earned' } = options || {};

  // Get credit accounts with user info
  const accounts = await prisma.creditAccount.findMany({
    take: limit,
    orderBy: sortBy === 'earned'
      ? { lifetimeEarned: 'desc' }
      : sortBy === 'pending'
        ? { pendingBalance: 'desc' }
        : { lifetimeEarned: 'desc' },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      },
    },
  });

  // Get order counts for each designer
  const userIds = accounts.map((a) => a.userId);
  const orderCounts = await prisma.order.groupBy({
    by: ['attributedDesignerId'],
    where: {
      attributedDesignerId: { in: userIds },
      status: { notIn: ['CANCELLED', 'RETURNED'] },
    },
    _count: { id: true },
    _sum: { retailAmountCents: true },
  });

  const orderCountMap = new Map(
    orderCounts.map((o) => [o.attributedDesignerId!, {
      count: o._count.id,
      value: (o._sum.retailAmountCents || 0) / 100,
    }])
  );

  return accounts
    .filter((a) => a.user.role === 'DESIGNER')
    .map((a) => {
      const orders = orderCountMap.get(a.userId) || { count: 0, value: 0 };

      return {
        designerId: a.userId,
        designerName: a.user.name,
        designerEmail: a.user.email,
        totalCreditEarned: Number(a.lifetimeEarned),
        totalCreditRedeemed: Number(a.lifetimeRedeemed),
        pendingCredits: Number(a.pendingBalance),
        availableCredits: Number(a.availableBalance),
        attributedOrderCount: orders.count,
        attributedOrderValue: orders.value,
      };
    });
}

/**
 * Estimate float yield based on current pending balances
 * Assumes 4-5% annual yield on invested float
 */
export function estimateFloatYield(
  pendingBalanceDollars: number,
  annualYieldPercent: number = 4.5,
  averageHoldDays: number = 30
): {
  dailyYield: number;
  monthlyYield: number;
  annualizedYield: number;
} {
  const dailyRate = annualYieldPercent / 365 / 100;
  const dailyYield = pendingBalanceDollars * dailyRate;

  return {
    dailyYield,
    monthlyYield: dailyYield * 30,
    annualizedYield: pendingBalanceDollars * (annualYieldPercent / 100),
  };
}
