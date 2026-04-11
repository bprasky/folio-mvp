/**
 * Commerce Credit System Utilities
 *
 * This module handles Folio Credit calculations, margin splits,
 * and credit account management for the trade discount arbitrage model.
 */

import type { PrismaClient, Prisma } from '@prisma/client';

// Type for prisma transaction client
type TransactionClient = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>;

/**
 * Standard margin split configuration
 * Based on 20% trade discount example from spec:
 * - Folio: 8% (platform margin, funds rep credit)
 * - Designer: 7% (earned as Folio Credit)
 * - Consumer: ~4% ("Folio Price" discount from retail)
 * - Rep Credit: 1% (funded from Folio's portion)
 * Net Folio margin after rep credit funding: 7%
 */
export interface MarginSplitConfig {
  folioPercent: number;      // Default 8% of margin
  designerPercent: number;   // Default 7% of margin
  consumerPercent: number;   // Default ~4% of margin (as discount)
  repPercent: number;        // Default 1% of margin
}

export interface MarginSplit {
  folioCents: number;
  designerCreditCents: number;
  repCreditCents: number;
  consumerDiscountCents: number;
}

/**
 * Default split ratios (percentages of the total margin)
 * These sum to 20% which is the typical trade discount
 */
export const DEFAULT_SPLIT_CONFIG: MarginSplitConfig = {
  folioPercent: 40,      // 40% of margin = 8% of retail
  designerPercent: 35,   // 35% of margin = 7% of retail
  consumerPercent: 20,   // 20% of margin = 4% of retail
  repPercent: 5,         // 5% of margin = 1% of retail
};

/**
 * Calculate the margin split for an order
 *
 * @param marginCents - Total margin in cents (retail - trade price)
 * @param discountPercent - The trade discount percentage (e.g., 20 for 20%)
 * @param config - Optional custom split configuration
 * @returns MarginSplit with amounts in cents
 */
export function calculateMarginSplit(
  marginCents: number,
  discountPercent: number = 20,
  config: MarginSplitConfig = DEFAULT_SPLIT_CONFIG
): MarginSplit {
  // Normalize discount percent to handle variations (15%-40%)
  // Scale the splits proportionally
  const scaleFactor = discountPercent / 20; // 20% is our baseline

  // Calculate each portion
  const folioCents = Math.round(marginCents * (config.folioPercent / 100));
  const designerCreditCents = Math.round(marginCents * (config.designerPercent / 100));
  const repCreditCents = Math.round(marginCents * (config.repPercent / 100));

  // Consumer discount is the remainder to ensure we don't exceed margin
  const consumerDiscountCents = marginCents - folioCents - designerCreditCents - repCreditCents;

  return {
    folioCents: Math.max(0, folioCents),
    designerCreditCents: Math.max(0, designerCreditCents),
    repCreditCents: Math.max(0, repCreditCents),
    consumerDiscountCents: Math.max(0, consumerDiscountCents),
  };
}

/**
 * Calculate trade price from retail price and discount percentage
 */
export function calculateTradePrice(retailCents: number, discountPercent: number): number {
  return Math.round(retailCents * (1 - discountPercent / 100));
}

/**
 * Calculate margin from retail and trade prices
 */
export function calculateMargin(retailCents: number, tradeCents: number): number {
  return retailCents - tradeCents;
}

/**
 * Calculate the "Folio Price" (retail - consumer discount)
 */
export function calculateFolioPrice(retailCents: number, split: MarginSplit): number {
  return retailCents - split.consumerDiscountCents;
}

export interface CreatePendingCreditParams {
  userId: string;
  amountCents: number;
  sourceType: 'DESIGNER_COMMISSION' | 'REP_ATTRIBUTION' | 'BONUS' | 'YIELD' | 'BOOST_REVENUE' | 'PHOTO_LICENSE';
  sourceOrderId?: string;
  availableAt: Date;
  description?: string;
  metadata?: Record<string, any>;
}

/**
 * Create a pending credit transaction
 * This is called when an order is delivered to allocate credits
 * Credits become available after the hold period (30 days)
 */
export async function createPendingCredit(
  tx: TransactionClient,
  params: CreatePendingCreditParams
): Promise<void> {
  const {
    userId,
    amountCents,
    sourceType,
    sourceOrderId,
    availableAt,
    description,
    metadata,
  } = params;

  // Get or create credit account
  let account = await tx.creditAccount.findUnique({
    where: { userId },
    select: { id: true },
  });

  if (!account) {
    account = await tx.creditAccount.create({
      data: {
        userId,
        availableBalance: 0,
        pendingBalance: 0,
        lifetimeEarned: 0,
        lifetimeRedeemed: 0,
      },
      select: { id: true },
    });
  }

  const amountDollars = amountCents / 100;

  // Create the pending transaction
  await tx.creditTransaction.create({
    data: {
      accountId: account.id,
      type: 'EARN',
      amount: amountDollars,
      sourceType,
      sourceOrderId,
      availableAt,
      description,
      metadata: metadata as Prisma.InputJsonValue,
    },
  });

  // Update pending balance
  await tx.creditAccount.update({
    where: { id: account.id },
    data: {
      pendingBalance: { increment: amountDollars },
      lifetimeEarned: { increment: amountDollars },
    },
  });
}

export interface RedeemCreditParams {
  userId: string;
  amountCents: number;
  orderId: string;
  description?: string;
}

/**
 * Redeem credit from user's available balance
 * This is called when a user applies credit to an order
 */
export async function redeemCredit(
  tx: TransactionClient,
  params: RedeemCreditParams
): Promise<{ success: boolean; error?: string }> {
  const { userId, amountCents, orderId, description } = params;

  const account = await tx.creditAccount.findUnique({
    where: { userId },
    select: { id: true, availableBalance: true },
  });

  if (!account) {
    return { success: false, error: 'No credit account found' };
  }

  const availableCents = Math.round(Number(account.availableBalance) * 100);
  if (amountCents > availableCents) {
    return { success: false, error: 'Insufficient credit balance' };
  }

  const amountDollars = amountCents / 100;

  // Create redemption transaction
  await tx.creditTransaction.create({
    data: {
      accountId: account.id,
      type: 'REDEEM',
      amount: -amountDollars, // Negative for redemption
      redemptionOrderId: orderId,
      availableAt: new Date(),
      processedAt: new Date(),
      description: description || `Credit applied to order`,
    },
  });

  // Update balance
  await tx.creditAccount.update({
    where: { id: account.id },
    data: {
      availableBalance: { decrement: amountDollars },
      lifetimeRedeemed: { increment: amountDollars },
    },
  });

  return { success: true };
}

/**
 * Release pending credits that have passed their hold period
 * This should be run as a scheduled job (e.g., daily cron)
 */
export async function releasePendingCredits(prisma: PrismaClient): Promise<{
  processed: number;
  totalAmountReleased: number;
}> {
  const now = new Date();
  let processed = 0;
  let totalAmountReleased = 0;

  // Find all pending EARN transactions past their availableAt date
  const pendingCredits = await prisma.creditTransaction.findMany({
    where: {
      type: 'EARN',
      availableAt: { lte: now },
      processedAt: null,
    },
    include: {
      account: true,
    },
  });

  for (const credit of pendingCredits) {
    await prisma.$transaction(async (tx) => {
      // Mark as processed
      await tx.creditTransaction.update({
        where: { id: credit.id },
        data: { processedAt: now },
      });

      // Move from pending to available
      const amount = Number(credit.amount);
      await tx.creditAccount.update({
        where: { id: credit.accountId },
        data: {
          pendingBalance: { decrement: amount },
          availableBalance: { increment: amount },
        },
      });

      processed++;
      totalAmountReleased += amount;
    });
  }

  return { processed, totalAmountReleased };
}

/**
 * Get credit account summary for a user
 */
export async function getCreditSummary(prisma: PrismaClient, userId: string) {
  const account = await prisma.creditAccount.findUnique({
    where: { userId },
    select: {
      availableBalance: true,
      pendingBalance: true,
      lifetimeEarned: true,
      lifetimeRedeemed: true,
    },
  });

  if (!account) {
    return {
      availableBalance: 0,
      pendingBalance: 0,
      lifetimeEarned: 0,
      lifetimeRedeemed: 0,
      totalBalance: 0,
    };
  }

  return {
    availableBalance: Number(account.availableBalance),
    pendingBalance: Number(account.pendingBalance),
    lifetimeEarned: Number(account.lifetimeEarned),
    lifetimeRedeemed: Number(account.lifetimeRedeemed),
    totalBalance: Number(account.availableBalance) + Number(account.pendingBalance),
  };
}

/**
 * Calculate tiered benefits based on balance
 * Based on spec:
 * - $500+: Monthly platform fee waived
 * - $1,000+: Early access to new vendor launches
 * - $2,500+: Priority editorial consideration
 * - $5,000+: Dedicated account support
 * - $10,000+: Invitation to Folio industry events
 */
export interface BalanceBenefits {
  tier: 'none' | 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';
  benefits: string[];
  nextTier?: {
    name: string;
    amountNeeded: number;
  };
}

export function calculateBalanceBenefits(balanceDollars: number): BalanceBenefits {
  if (balanceDollars >= 10000) {
    return {
      tier: 'diamond',
      benefits: [
        'Monthly platform fee waived',
        'Early access to new vendor launches',
        'Priority editorial consideration',
        'Dedicated account support',
        'Invitation to Folio industry events',
      ],
    };
  }

  if (balanceDollars >= 5000) {
    return {
      tier: 'platinum',
      benefits: [
        'Monthly platform fee waived',
        'Early access to new vendor launches',
        'Priority editorial consideration',
        'Dedicated account support',
      ],
      nextTier: {
        name: 'diamond',
        amountNeeded: 10000 - balanceDollars,
      },
    };
  }

  if (balanceDollars >= 2500) {
    return {
      tier: 'gold',
      benefits: [
        'Monthly platform fee waived',
        'Early access to new vendor launches',
        'Priority editorial consideration',
      ],
      nextTier: {
        name: 'platinum',
        amountNeeded: 5000 - balanceDollars,
      },
    };
  }

  if (balanceDollars >= 1000) {
    return {
      tier: 'silver',
      benefits: [
        'Monthly platform fee waived',
        'Early access to new vendor launches',
      ],
      nextTier: {
        name: 'gold',
        amountNeeded: 2500 - balanceDollars,
      },
    };
  }

  if (balanceDollars >= 500) {
    return {
      tier: 'bronze',
      benefits: [
        'Monthly platform fee waived',
      ],
      nextTier: {
        name: 'silver',
        amountNeeded: 1000 - balanceDollars,
      },
    };
  }

  return {
    tier: 'none',
    benefits: [],
    nextTier: {
      name: 'bronze',
      amountNeeded: 500 - balanceDollars,
    },
  };
}
