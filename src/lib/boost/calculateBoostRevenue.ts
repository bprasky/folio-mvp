/**
 * Boost Revenue Calculation Engine
 *
 * Converts InContextBoost impressions/clicks into designer credits and Folio revenue.
 * Revenue model: Fixed CPM ($5/1000 impressions) + CPC ($0.25/click)
 * Split: 70% designer, 30% Folio
 */

import { prisma } from '@/lib/prisma';
import { createPendingCredit } from '@/lib/commerce/credits';

// Revenue rates (in cents)
const CPM_RATE_CENTS = 500;  // $5.00 per 1000 impressions
const CPC_RATE_CENTS = 25;   // $0.25 per click

// Revenue split
const DESIGNER_SHARE = 0.70;
const FOLIO_SHARE = 0.30;

export interface BoostRevenueResult {
  boostId: string;
  grossCents: number;
  designerCents: number;
  folioCents: number;
  newImpressions: number;
  newClicks: number;
}

/**
 * Calculate revenue for a single boost based on new impressions/clicks since last billing.
 */
export function calculateBoostGross(
  impressions: number,
  lastBilledImpressions: number,
  clicks: number,
  lastBilledClicks: number,
): { grossCents: number; newImpressions: number; newClicks: number } {
  const newImpressions = impressions - lastBilledImpressions;
  const newClicks = clicks - lastBilledClicks;

  if (newImpressions <= 0 && newClicks <= 0) {
    return { grossCents: 0, newImpressions: 0, newClicks: 0 };
  }

  const impressionRevenue = Math.floor((newImpressions * CPM_RATE_CENTS) / 1000);
  const clickRevenue = newClicks * CPC_RATE_CENTS;
  const grossCents = impressionRevenue + clickRevenue;

  return { grossCents, newImpressions: Math.max(0, newImpressions), newClicks: Math.max(0, newClicks) };
}

/**
 * Process all unbilled boost revenue.
 * Called by cron job (daily) or manually triggered.
 *
 * For each APPROVED boost with new impressions/clicks since last billing:
 * 1. Calculate gross revenue
 * 2. Split 70/30 (designer/Folio)
 * 3. Create CreditTransaction for designer
 * 4. Update boost billing records
 */
export async function processAllBoostRevenue(): Promise<{
  processed: number;
  totalGrossCents: number;
  totalDesignerCents: number;
  totalFolioCents: number;
  results: BoostRevenueResult[];
}> {
  // Find all APPROVED boosts with unbilled activity
  const boosts = await prisma.inContextBoost.findMany({
    where: {
      status: 'APPROVED',
    },
    select: {
      id: true,
      designerId: true,
      productId: true,
      impressions: true,
      clicks: true,
      lastBilledImpressions: true,
      lastBilledClicks: true,
      designerPayoutCents: true,
      folioRevenueCents: true,
      vendorSpendCents: true,
      product: { select: { name: true } },
    },
  });

  const results: BoostRevenueResult[] = [];
  let totalGrossCents = 0;
  let totalDesignerCents = 0;
  let totalFolioCents = 0;
  let processed = 0;

  for (const boost of boosts) {
    const { grossCents, newImpressions, newClicks } = calculateBoostGross(
      boost.impressions,
      boost.lastBilledImpressions,
      boost.clicks,
      boost.lastBilledClicks,
    );

    if (grossCents <= 0) continue;

    const designerCents = Math.round(grossCents * DESIGNER_SHARE);
    const folioCents = grossCents - designerCents; // Remainder to avoid rounding errors

    // Create credit transaction for designer
    await prisma.$transaction(async (tx) => {
      // Create pending credit (available immediately for boost revenue — no hold period)
      await createPendingCredit(tx as any, {
        userId: boost.designerId,
        amountCents: designerCents,
        sourceType: 'BOOST_REVENUE',
        availableAt: new Date(), // Available immediately
        description: `Boost revenue for "${boost.product.name}" (${newImpressions} impressions, ${newClicks} clicks)`,
        metadata: {
          boostId: boost.id,
          productId: boost.productId,
          newImpressions,
          newClicks,
          grossCents,
          designerShare: DESIGNER_SHARE,
        },
      });

      // Update boost billing records
      await tx.inContextBoost.update({
        where: { id: boost.id },
        data: {
          lastBilledImpressions: boost.impressions,
          lastBilledClicks: boost.clicks,
          designerPayoutCents: { increment: designerCents },
          folioRevenueCents: { increment: folioCents },
          vendorSpendCents: { increment: grossCents },
          lastBilledAt: new Date(),
        },
      });
    });

    results.push({
      boostId: boost.id,
      grossCents,
      designerCents,
      folioCents,
      newImpressions,
      newClicks,
    });

    totalGrossCents += grossCents;
    totalDesignerCents += designerCents;
    totalFolioCents += folioCents;
    processed++;
  }

  return { processed, totalGrossCents, totalDesignerCents, totalFolioCents, results };
}
