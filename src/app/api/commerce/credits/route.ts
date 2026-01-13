export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/commerce/credits
 * Get the current user's credit account balance and summary
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get or create credit account
    let creditAccount = await prisma.creditAccount.findUnique({
      where: { userId: session.user.id },
      select: {
        id: true,
        availableBalance: true,
        pendingBalance: true,
        lifetimeEarned: true,
        lifetimeRedeemed: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // If no credit account exists, create one
    if (!creditAccount) {
      creditAccount = await prisma.creditAccount.create({
        data: {
          userId: session.user.id,
          availableBalance: 0,
          pendingBalance: 0,
          lifetimeEarned: 0,
          lifetimeRedeemed: 0,
        },
        select: {
          id: true,
          availableBalance: true,
          pendingBalance: true,
          lifetimeEarned: true,
          lifetimeRedeemed: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    }

    // Get count of pending transactions (for hold period)
    const pendingTransactionCount = await prisma.creditTransaction.count({
      where: {
        accountId: creditAccount.id,
        type: 'EARN',
        availableAt: { gt: new Date() },
        processedAt: null,
      },
    });

    // Get next release date (when pending credits become available)
    const nextRelease = await prisma.creditTransaction.findFirst({
      where: {
        accountId: creditAccount.id,
        type: 'EARN',
        availableAt: { gt: new Date() },
        processedAt: null,
      },
      orderBy: { availableAt: 'asc' },
      select: { availableAt: true, amount: true },
    });

    return NextResponse.json({
      ok: true,
      account: {
        ...creditAccount,
        // Convert Decimal to number for JSON serialization
        availableBalance: Number(creditAccount.availableBalance),
        pendingBalance: Number(creditAccount.pendingBalance),
        lifetimeEarned: Number(creditAccount.lifetimeEarned),
        lifetimeRedeemed: Number(creditAccount.lifetimeRedeemed),
      },
      pending: {
        count: pendingTransactionCount,
        nextRelease: nextRelease ? {
          date: nextRelease.availableAt,
          amount: Number(nextRelease.amount),
        } : null,
      },
    });
  } catch (error: any) {
    console.error('[commerce/credits][GET]', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
