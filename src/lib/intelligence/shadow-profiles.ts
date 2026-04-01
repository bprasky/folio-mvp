/**
 * Shadow Profile Recalculation
 *
 * Aggregates ActionItemSignals, PendingActions, and ProductTag data
 * into VendorShadowProfile and RepShadowProfile records.
 *
 * Called daily via cron or manually via admin API.
 */

import { prisma } from '@/lib/prisma';

/**
 * Recalculate all vendor shadow profiles from signal data.
 */
export async function recalculateVendorShadowProfiles(): Promise<number> {
  // Aggregate signals by vendor (using product -> brand mapping)
  const vendorSignals = await prisma.$queryRaw<Array<{
    vendorName: string;
    vendorOrgId: string | null;
    totalProducts: bigint;
    totalProjects: bigint;
    totalDesigners: bigint;
  }>>`
    SELECT
      p.brand AS "vendorName",
      s."vendorOrgId",
      COUNT(DISTINCT s."productId") AS "totalProducts",
      COUNT(DISTINCT s."projectId") AS "totalProjects",
      COUNT(DISTINCT s."designerOrgId") AS "totalDesigners"
    FROM action_item_signals s
    JOIN products p ON p.id = s."productId"
    WHERE p.brand IS NOT NULL AND p.brand != ''
    GROUP BY p.brand, s."vendorOrgId"
  `;

  let updated = 0;

  for (const row of vendorSignals) {
    if (!row.vendorName) continue;

    // Get geo distribution from signals
    const geoSignals = await prisma.actionItemSignal.groupBy({
      by: ['location'],
      where: {
        product: { brand: row.vendorName },
        location: { not: null },
      },
      _count: { id: true },
    });

    const geoDistribution: Record<string, number> = {};
    const totalGeo = geoSignals.reduce((sum, g) => sum + g._count.id, 0);
    for (const g of geoSignals) {
      if (g.location && totalGeo > 0) {
        geoDistribution[g.location] = Math.round((g._count.id / totalGeo) * 100) / 100;
      }
    }

    // Get project type distribution
    const typeSignals = await prisma.actionItemSignal.groupBy({
      by: ['projectType'],
      where: {
        product: { brand: row.vendorName },
        projectType: { not: null },
      },
      _count: { id: true },
    });

    const projectTypeDist: Record<string, number> = {};
    const totalType = typeSignals.reduce((sum, t) => sum + t._count.id, 0);
    for (const t of typeSignals) {
      if (t.projectType && totalType > 0) {
        projectTypeDist[t.projectType] = Math.round((t._count.id / totalType) * 100) / 100;
      }
    }

    // Get top products by signal volume
    const topProductSignals = await prisma.actionItemSignal.groupBy({
      by: ['productId'],
      where: { product: { brand: row.vendorName } },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    });

    const topProductIds = topProductSignals.map(t => t.productId);
    const topProductNames = await prisma.product.findMany({
      where: { id: { in: topProductIds } },
      select: { id: true, name: true },
    });
    const nameMap = new Map(topProductNames.map(p => [p.id, p.name]));

    const topProducts = topProductSignals.map(t => ({
      productId: t.productId,
      productName: nameMap.get(t.productId) || 'Unknown',
      signalCount: t._count.id,
    }));

    // Upsert shadow profile
    await prisma.vendorShadowProfile.upsert({
      where: { vendorName: row.vendorName },
      create: {
        vendorName: row.vendorName,
        vendorOrgId: row.vendorOrgId || null,
        totalProducts: Number(row.totalProducts),
        totalProjects: Number(row.totalProjects),
        totalDesigners: Number(row.totalDesigners),
        geoDistribution: Object.keys(geoDistribution).length > 0 ? geoDistribution : null,
        projectTypeDist: Object.keys(projectTypeDist).length > 0 ? projectTypeDist : null,
        topProducts: topProducts.length > 0 ? topProducts : null,
      },
      update: {
        vendorOrgId: row.vendorOrgId || undefined,
        totalProducts: Number(row.totalProducts),
        totalProjects: Number(row.totalProjects),
        totalDesigners: Number(row.totalDesigners),
        geoDistribution: Object.keys(geoDistribution).length > 0 ? geoDistribution : null,
        projectTypeDist: Object.keys(projectTypeDist).length > 0 ? projectTypeDist : null,
        topProducts: topProducts.length > 0 ? topProducts : null,
      },
    });

    updated++;
  }

  // Also build shadow profiles from PendingActions (off-platform vendor data)
  const pendingVendors = await prisma.pendingAction.groupBy({
    by: ['targetEmail'],
    where: { status: { in: ['PENDING', 'EMAIL_SENT'] } },
    _count: { id: true },
  });

  // Seed rep shadow profiles from pending actions
  for (const pv of pendingVendors) {
    const actions = await prisma.pendingAction.findMany({
      where: { targetEmail: pv.targetEmail },
      select: {
        targetName: true,
        targetEmail: true,
        product: { select: { brand: true } },
        sender: { select: { location: true } },
      },
      take: 1,
    });

    if (actions.length === 0) continue;
    const action = actions[0];
    const vendorName = action.product.brand;
    if (!vendorName) continue;

    // Ensure vendor shadow exists
    const vendorShadow = await prisma.vendorShadowProfile.upsert({
      where: { vendorName },
      create: { vendorName },
      update: {},
    });

    // Upsert rep shadow
    if (action.targetEmail) {
      await prisma.repShadowProfile.upsert({
        where: {
          vendorShadowId_repEmail: {
            vendorShadowId: vendorShadow.id,
            repEmail: action.targetEmail,
          },
        },
        create: {
          vendorShadowId: vendorShadow.id,
          repName: action.targetName,
          repEmail: action.targetEmail,
          totalRequests: pv._count.id,
          inferredTerritory: action.sender.location || null,
        },
        update: {
          totalRequests: pv._count.id,
        },
      });
    }
  }

  return updated;
}

/**
 * Seed a RepShadowProfile from an invite-rep action.
 * Called when a designer invites a rep who isn't on Folio.
 */
export async function seedRepShadowFromInvite(params: {
  vendorName: string;
  repName: string;
  repEmail: string;
  designerLocation?: string;
}): Promise<void> {
  try {
    // Ensure vendor shadow exists
    const vendorShadow = await prisma.vendorShadowProfile.upsert({
      where: { vendorName: params.vendorName },
      create: { vendorName: params.vendorName },
      update: {},
    });

    // Upsert rep shadow
    await prisma.repShadowProfile.upsert({
      where: {
        vendorShadowId_repEmail: {
          vendorShadowId: vendorShadow.id,
          repEmail: params.repEmail,
        },
      },
      create: {
        vendorShadowId: vendorShadow.id,
        repName: params.repName,
        repEmail: params.repEmail,
        totalRequests: 1,
        designersServed: 1,
        inferredTerritory: params.designerLocation || null,
      },
      update: {
        totalRequests: { increment: 1 },
      },
    });
  } catch (error) {
    console.error('[seedRepShadowFromInvite] Failed:', error);
  }
}
