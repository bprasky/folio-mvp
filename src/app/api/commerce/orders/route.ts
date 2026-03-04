export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { calculateMarginSplit, createPendingCredit } from '@/lib/commerce/credits';

/**
 * GET /api/commerce/orders
 * List orders for the current user (as purchaser or attributed designer/rep)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '20', 10);
    const status = searchParams.get('status');
    const role = searchParams.get('role'); // 'purchaser', 'designer', 'rep'

    // Build where clause based on role
    const where: any = {};

    if (role === 'purchaser') {
      where.purchaserUserId = session.user.id;
    } else if (role === 'designer') {
      where.attributedDesignerId = session.user.id;
    } else if (role === 'rep') {
      where.attributedRepId = session.user.id;
    } else {
      // Default: show all orders where user is involved
      where.OR = [
        { purchaserUserId: session.user.id },
        { attributedDesignerId: session.user.id },
        { attributedRepId: session.user.id },
      ];
    }

    if (status) {
      where.status = status;
    }

    const total = await prisma.order.count({ where });

    const orders = await prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        status: true,
        fulfillmentMethod: true,
        retailAmountCents: true,
        tradeAmountCents: true,
        marginAmountCents: true,
        designerCreditCents: true,
        repCreditCents: true,
        consumerDiscountCents: true,
        creditAppliedCents: true,
        cashPaidCents: true,
        vendorOrderRef: true,
        trackingNumber: true,
        notes: true,
        createdAt: true,
        confirmedAt: true,
        shippedAt: true,
        deliveredAt: true,
        purchaserUser: {
          select: { id: true, name: true, email: true },
        },
        attributedDesigner: {
          select: { id: true, name: true },
        },
        attributedRep: {
          select: { id: true, name: true },
        },
        vendorOrg: {
          select: { id: true, name: true },
        },
        project: {
          select: { id: true, title: true },
        },
        items: {
          select: {
            id: true,
            quantity: true,
            retailPriceCents: true,
            tradePriceCents: true,
            productName: true,
            colorFinish: true,
          },
        },
      },
    });

    return NextResponse.json({
      ok: true,
      orders,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error: any) {
    console.error('[commerce/orders][GET]', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

/**
 * POST /api/commerce/orders
 * Create a new order
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      vendorOrgId,
      projectId,
      attributedDesignerId,
      attributedRepId,
      attributedProductTagId,
      fulfillmentMethod,
      tradeAccountId,
      items,
      creditAppliedCents = 0,
      notes,
    } = body;

    // Validate required fields
    if (!vendorOrgId || !items?.length || !fulfillmentMethod) {
      return NextResponse.json(
        { error: 'Missing required fields: vendorOrgId, items, fulfillmentMethod' },
        { status: 400 }
      );
    }

    // Validate fulfillment method
    const validMethods = ['TRADE_LOGIN', 'QUOTE', 'REP_MEDIATED', 'API'];
    if (!validMethods.includes(fulfillmentMethod)) {
      return NextResponse.json(
        { error: `Invalid fulfillment method. Must be one of: ${validMethods.join(', ')}` },
        { status: 400 }
      );
    }

    // Get trade account to determine discount percentage
    let discountPercent = 20; // Default 20%
    if (tradeAccountId) {
      const tradeAccount = await prisma.vendorTradeAccount.findUnique({
        where: { id: tradeAccountId },
        select: { discountPercent: true, isActive: true },
      });
      if (tradeAccount?.isActive) {
        discountPercent = Number(tradeAccount.discountPercent);
      }
    }

    // Calculate totals from items
    let totalRetailCents = 0;
    let totalTradeCents = 0;

    const orderItems = [];
    for (const item of items) {
      const { productId, quantity, retailPriceCents, tradePriceCents, productName, productSku, colorFinish, productTagId } = item;

      if (!productId || !quantity || !retailPriceCents) {
        return NextResponse.json(
          { error: 'Each item requires productId, quantity, and retailPriceCents' },
          { status: 400 }
        );
      }

      // If trade price not provided, calculate from discount
      const actualTradeCents = tradePriceCents || Math.round(retailPriceCents * (1 - discountPercent / 100));

      totalRetailCents += retailPriceCents * quantity;
      totalTradeCents += actualTradeCents * quantity;

      orderItems.push({
        productId,
        quantity,
        retailPriceCents,
        tradePriceCents: actualTradeCents,
        productName: productName || 'Unknown Product',
        productSku,
        colorFinish,
        productTagId,
      });
    }

    // Calculate margin split
    const marginCents = totalRetailCents - totalTradeCents;
    const split = calculateMarginSplit(marginCents, discountPercent);

    const cashPaidCents = totalRetailCents - split.consumerDiscountCents - creditAppliedCents;

    // Create order with items in a transaction (credit check INSIDE to prevent TOCTOU race)
    const order = await prisma.$transaction(async (tx) => {
      // Validate credit application inside the transaction to prevent double-spend
      if (creditAppliedCents > 0) {
        const creditAccount = await tx.creditAccount.findUnique({
          where: { userId: session.user.id },
          select: { availableBalance: true },
        });

        const availableCents = Math.round(Number(creditAccount?.availableBalance || 0) * 100);
        if (creditAppliedCents > availableCents) {
          throw Object.assign(new Error('Insufficient credit balance'), { status: 400 });
        }
      }

      // Create the order
      const newOrder = await tx.order.create({
        data: {
          purchaserUserId: session.user.id,
          vendorOrgId,
          projectId,
          attributedDesignerId,
          attributedRepId,
          attributedProductTagId,
          retailAmountCents: totalRetailCents,
          tradeAmountCents: totalTradeCents,
          marginAmountCents: marginCents,
          folioAmountCents: split.folioCents,
          designerCreditCents: split.designerCreditCents,
          repCreditCents: split.repCreditCents,
          consumerDiscountCents: split.consumerDiscountCents,
          creditAppliedCents,
          cashPaidCents,
          tradeAccountId,
          fulfillmentMethod: fulfillmentMethod as any,
          status: 'PENDING',
          notes,
        },
      });

      // Create order items
      await tx.orderItem.createMany({
        data: orderItems.map((item) => ({
          orderId: newOrder.id,
          ...item,
        })),
      });

      // Deduct credit if applied
      if (creditAppliedCents > 0) {
        await tx.creditAccount.update({
          where: { userId: session.user.id },
          data: {
            availableBalance: { decrement: creditAppliedCents / 100 },
            lifetimeRedeemed: { increment: creditAppliedCents / 100 },
          },
        });

        // Record credit redemption transaction
        const account = await tx.creditAccount.findUnique({
          where: { userId: session.user.id },
          select: { id: true },
        });

        if (account) {
          await tx.creditTransaction.create({
            data: {
              accountId: account.id,
              type: 'REDEEM',
              amount: -(creditAppliedCents / 100),
              redemptionOrderId: newOrder.id,
              availableAt: new Date(),
              processedAt: new Date(),
              description: `Credit applied to order`,
            },
          });
        }
      }

      return newOrder;
    });

    return NextResponse.json({
      ok: true,
      order: {
        id: order.id,
        status: order.status,
        retailAmountCents: order.retailAmountCents,
        tradeAmountCents: order.tradeAmountCents,
        marginAmountCents: order.marginAmountCents,
        designerCreditCents: order.designerCreditCents,
        repCreditCents: order.repCreditCents,
        consumerDiscountCents: order.consumerDiscountCents,
        creditAppliedCents: order.creditAppliedCents,
        cashPaidCents: order.cashPaidCents,
        createdAt: order.createdAt,
      },
    });
  } catch (error: any) {
    if (error.status === 400) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('[commerce/orders][POST]', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
