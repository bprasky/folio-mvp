/**
 * Credit Account Management
 *
 * Handles Folio Credit earning, redemption, and balance tracking.
 * Credits have a 30-day hold period before becoming available.
 */

import { prisma } from '@/lib/prisma';
import { CreditTransactionType, CreditSourceType } from '@prisma/client';

const HOLD_PERIOD_DAYS = 30;

export async function getOrCreateCreditAccount(userId: string) {
  return prisma.creditAccount.upsert({
    where: { userId },
    create: { userId },
    update: {},
  });
}

export async function earnCredit(params: {
  userId: string;
  amountCents: number;
  sourceType: CreditSourceType;
  sourceOrderId?: string;
  description?: string;
}) {
  const { userId, amountCents, sourceType, sourceOrderId, description } = params;

  const account = await getOrCreateCreditAccount(userId);

  // Calculate availability date (30 days from now)
  const availableAt = new Date();
  availableAt.setDate(availableAt.getDate() + HOLD_PERIOD_DAYS);

  // Round to start of month for monthly windows
  availableAt.setDate(1);
  availableAt.setMonth(availableAt.getMonth() + 1);

  const amount = amountCents / 100; // Convert to dollars for Decimal field

  return prisma.$transaction([
    prisma.creditTransaction.create({
      data: {
        accountId: account.id,
        type: CreditTransactionType.EARN,
        amount,
        sourceType,
        sourceOrderId,
        availableAt,
        description,
      },
    }),
    prisma.creditAccount.update({
      where: { id: account.id },
      data: {
        pendingBalance: { increment: amount },
        lifetimeEarned: { increment: amount },
      },
    }),
  ]);
}

export async function redeemCredit(params: {
  userId: string;
  amountCents: number;
  redemptionOrderId: string;
  description?: string;
}) {
  const { userId, amountCents, redemptionOrderId, description } = params;

  const account = await prisma.creditAccount.findUnique({
    where: { userId },
  });

  if (!account) {
    throw new Error('Credit account not found');
  }

  const amount = amountCents / 100;

  if (account.availableBalance.toNumber() < amount) {
    throw new Error('Insufficient available credit balance');
  }

  return prisma.$transaction([
    prisma.creditTransaction.create({
      data: {
        accountId: account.id,
        type: CreditTransactionType.REDEEM,
        amount: -amount, // Negative for redemption
        redemptionOrderId,
        availableAt: new Date(), // Immediate
        description,
      },
    }),
    prisma.creditAccount.update({
      where: { id: account.id },
      data: {
        availableBalance: { decrement: amount },
        lifetimeRedeemed: { increment: amount },
      },
    }),
  ]);
}

export async function processPendingCredits() {
  /**
   * Run daily/hourly to move matured pending credits to available.
   * Call this from a cron job.
   */
  const now = new Date();

  // Find all EARN transactions that have matured but haven't been processed
  // We track this by checking if the transaction's availableAt is in the past
  // and if it was credited to pending (we need to move it to available)
  const maturedTransactions = await prisma.creditTransaction.findMany({
    where: {
      type: CreditTransactionType.EARN,
      availableAt: { lte: now },
    },
    include: {
      account: true,
    },
  });

  // Group by account and sum amounts
  const byAccount = new Map<string, number>();
  for (const tx of maturedTransactions) {
    const current = byAccount.get(tx.accountId) || 0;
    byAccount.set(tx.accountId, current + tx.amount.toNumber());
  }

  // Update each account - move from pending to available
  const updates = [];
  for (const [accountId, amount] of byAccount) {
    updates.push(
      prisma.creditAccount.update({
        where: { id: accountId },
        data: {
          pendingBalance: { decrement: amount },
          availableBalance: { increment: amount },
        },
      })
    );
  }

  if (updates.length > 0) {
    await prisma.$transaction(updates);
  }

  return { processed: maturedTransactions.length };
}

export async function getCreditBalance(userId: string) {
  const account = await prisma.creditAccount.findUnique({
    where: { userId },
  });

  if (!account) {
    return {
      available: 0,
      pending: 0,
      lifetime: { earned: 0, redeemed: 0 },
    };
  }

  return {
    available: account.availableBalance.toNumber(),
    pending: account.pendingBalance.toNumber(),
    lifetime: {
      earned: account.lifetimeEarned.toNumber(),
      redeemed: account.lifetimeRedeemed.toNumber(),
    },
  };
}

export async function getCreditTransactions(
  userId: string,
  options: { limit?: number; cursor?: string } = {}
) {
  const { limit = 20, cursor } = options;

  const account = await prisma.creditAccount.findUnique({
    where: { userId },
  });

  if (!account) {
    return { transactions: [], nextCursor: null };
  }

  const transactions = await prisma.creditTransaction.findMany({
    where: { accountId: account.id },
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
    cursor: cursor ? { id: cursor } : undefined,
    include: {
      sourceOrder: {
        select: { orderNumber: true },
      },
      redemptionOrder: {
        select: { orderNumber: true },
      },
    },
  });

  const hasMore = transactions.length > limit;
  const items = hasMore ? transactions.slice(0, -1) : transactions;
  const nextCursor = hasMore ? items[items.length - 1].id : null;

  return {
    transactions: items,
    nextCursor,
  };
}
