export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/commerce/credits/transactions
 * Get the current user's credit transaction history
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '20', 10);
    const type = searchParams.get('type'); // EARN, REDEEM, EXPIRE, ADJUSTMENT

    // Get credit account
    const creditAccount = await prisma.creditAccount.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    });

    if (!creditAccount) {
      return NextResponse.json({
        ok: true,
        transactions: [],
        total: 0,
        page,
        pageSize,
        totalPages: 0,
      });
    }

    // Build where clause
    const where: any = { accountId: creditAccount.id };
    if (type) {
      where.type = type;
    }

    // Get total count
    const total = await prisma.creditTransaction.count({ where });

    // Get transactions with pagination
    const transactions = await prisma.creditTransaction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        type: true,
        amount: true,
        sourceType: true,
        sourceOrderId: true,
        redemptionOrderId: true,
        availableAt: true,
        processedAt: true,
        description: true,
        metadata: true,
        createdAt: true,
        sourceOrder: {
          select: {
            id: true,
            vendorOrg: {
              select: { name: true },
            },
          },
        },
        redemptionOrder: {
          select: {
            id: true,
            vendorOrg: {
              select: { name: true },
            },
          },
        },
      },
    });

    // Format transactions for response
    const formattedTransactions = transactions.map((tx) => ({
      id: tx.id,
      type: tx.type,
      amount: Number(tx.amount),
      sourceType: tx.sourceType,
      sourceOrderId: tx.sourceOrderId,
      redemptionOrderId: tx.redemptionOrderId,
      availableAt: tx.availableAt,
      processedAt: tx.processedAt,
      description: tx.description,
      metadata: tx.metadata,
      createdAt: tx.createdAt,
      isPending: tx.availableAt > new Date() && !tx.processedAt,
      sourceOrderVendor: tx.sourceOrder?.vendorOrg?.name || null,
      redemptionOrderVendor: tx.redemptionOrder?.vendorOrg?.name || null,
    }));

    return NextResponse.json({
      ok: true,
      transactions: formattedTransactions,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error: any) {
    console.error('[commerce/credits/transactions][GET]', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
