/**
 * Order Management
 *
 * Handles order creation, attribution, and margin splitting.
 */

import { prisma } from '@/lib/prisma';
import { OrderStatus, FulfillmentMethod, CreditSourceType } from '@prisma/client';
import { earnCredit, redeemCredit } from './credit';

// Default split percentages (can be overridden per vendor)
const DEFAULT_SPLITS = {
  folio: 8,
  designer: 7,
  rep: 1,
  consumer: 4,
};

interface CreateOrderParams {
  purchaserUserId: string;
  vendorId: string;
  items: {
    productId: string;
    quantity: number;
    retailPriceCents: number;
    productTagId?: string;
  }[];
  attributedDesignerId?: string;
  attributedRepId?: string;
  creditToApplyCents?: number;
  fulfillmentMethod: FulfillmentMethod;
}

export async function createOrder(params: CreateOrderParams) {
  const {
    purchaserUserId,
    vendorId,
    items,
    attributedDesignerId,
    attributedRepId,
    creditToApplyCents = 0,
    fulfillmentMethod,
  } = params;

  // Get vendor trade account for discount percentage
  const tradeAccount = await prisma.vendorTradeAccount.findUnique({
    where: { vendorId },
  });

  if (!tradeAccount || !tradeAccount.isActive) {
    throw new Error('Vendor does not have an active trade account');
  }

  const discountPercent = tradeAccount.discountPercent.toNumber();

  // Calculate totals
  let totalRetailCents = 0;
  const orderItems = [];

  for (const item of items) {
    const retailTotal = item.retailPriceCents * item.quantity;
    const tradePrice = Math.round(item.retailPriceCents * (1 - discountPercent / 100));

    totalRetailCents += retailTotal;
    orderItems.push({
      ...item,
      tradePriceCents: tradePrice,
    });
  }

  const totalTradeCents = Math.round(totalRetailCents * (1 - discountPercent / 100));
  const marginCents = totalRetailCents - totalTradeCents;

  // Calculate splits based on margin
  const folioAmountCents = Math.round(marginCents * (DEFAULT_SPLITS.folio / 100));
  const designerCreditAmountCents = attributedDesignerId
    ? Math.round(marginCents * (DEFAULT_SPLITS.designer / 100))
    : 0;
  const repCreditAmountCents = attributedRepId
    ? Math.round(marginCents * (DEFAULT_SPLITS.rep / 100))
    : 0;
  const consumerDiscountCents = Math.round(marginCents * (DEFAULT_SPLITS.consumer / 100));

  // Apply credit redemption (can't exceed amount after consumer discount)
  const maxCreditApplicable = totalRetailCents - consumerDiscountCents;
  const actualCreditApplied = Math.min(creditToApplyCents, maxCreditApplicable);
  const cashPaidCents = maxCreditApplicable - actualCreditApplied;

  // Create order
  const order = await prisma.order.create({
    data: {
      purchaserUserId,
      vendorId,
      attributedDesignerId,
      attributedRepId,
      retailAmountCents: totalRetailCents,
      tradeAmountCents: totalTradeCents,
      marginAmountCents: marginCents,
      folioAmountCents,
      designerCreditAmountCents,
      repCreditAmountCents,
      consumerDiscountCents,
      creditAppliedCents: actualCreditApplied,
      cashPaidCents,
      fulfillmentMethod,
      status: OrderStatus.PENDING,
      items: {
        create: orderItems.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          retailPriceCents: item.retailPriceCents,
          tradePriceCents: item.tradePriceCents,
          productTagId: item.productTagId,
        })),
      },
    },
    include: {
      items: true,
    },
  });

  // Process credit redemption if any
  if (actualCreditApplied > 0) {
    await redeemCredit({
      userId: purchaserUserId,
      amountCents: actualCreditApplied,
      redemptionOrderId: order.id,
      description: `Applied to order ${order.orderNumber}`,
    });
  }

  return order;
}

export async function completeOrder(orderId: string) {
  /**
   * Called when order is confirmed delivered/completed.
   * Triggers credit earning for designer and rep.
   */
  const order = await prisma.order.findUnique({
    where: { id: orderId },
  });

  if (!order) {
    throw new Error('Order not found');
  }

  if (order.status === OrderStatus.COMPLETED) {
    throw new Error('Order already completed');
  }

  // Update order status
  await prisma.order.update({
    where: { id: orderId },
    data: { status: OrderStatus.COMPLETED },
  });

  // Earn credit for designer
  if (order.attributedDesignerId && order.designerCreditAmountCents > 0) {
    await earnCredit({
      userId: order.attributedDesignerId,
      amountCents: order.designerCreditAmountCents,
      sourceType: CreditSourceType.DESIGNER_COMMISSION,
      sourceOrderId: order.id,
      description: `Commission from order ${order.orderNumber}`,
    });
  }

  // Earn credit for rep
  if (order.attributedRepId && order.repCreditAmountCents > 0) {
    await earnCredit({
      userId: order.attributedRepId,
      amountCents: order.repCreditAmountCents,
      sourceType: CreditSourceType.REP_ATTRIBUTION,
      sourceOrderId: order.id,
      description: `Attribution from order ${order.orderNumber}`,
    });
  }

  return order;
}

export async function cancelOrder(orderId: string, reason?: string) {
  /**
   * Cancel order and reverse any credit redemptions.
   */
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      redeemedCredits: true,
    },
  });

  if (!order) {
    throw new Error('Order not found');
  }

  // Prevent cancellation of completed orders
  if (order.status === OrderStatus.COMPLETED) {
    throw new Error('Cannot cancel a completed order');
  }

  // Reverse credit redemption if any
  if (order.creditAppliedCents > 0) {
    await earnCredit({
      userId: order.purchaserUserId,
      amountCents: order.creditAppliedCents,
      sourceType: CreditSourceType.ADJUSTMENT,
      sourceOrderId: order.id,
      description: `Refund from cancelled order ${order.orderNumber}`,
    });
  }

  // Update order status
  return prisma.order.update({
    where: { id: orderId },
    data: {
      status: OrderStatus.CANCELLED,
      fulfillmentNotes: reason,
    },
  });
}

export async function getOrder(orderId: string) {
  return prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: {
        include: {
          product: true,
          productTag: true,
        },
      },
      purchaserUser: {
        select: { id: true, name: true, email: true },
      },
      attributedDesigner: {
        select: { id: true, name: true, email: true },
      },
      attributedRep: {
        select: { id: true, name: true, email: true },
      },
      vendor: {
        select: { id: true, name: true },
      },
    },
  });
}

export async function getUserOrders(
  userId: string,
  options: { limit?: number; cursor?: string; status?: OrderStatus } = {}
) {
  const { limit = 20, cursor, status } = options;

  const orders = await prisma.order.findMany({
    where: {
      purchaserUserId: userId,
      ...(status && { status }),
    },
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
    cursor: cursor ? { id: cursor } : undefined,
    include: {
      items: {
        include: {
          product: {
            select: { id: true, name: true, imageUrl: true },
          },
        },
      },
      vendor: {
        select: { id: true, name: true },
      },
    },
  });

  const hasMore = orders.length > limit;
  const items = hasMore ? orders.slice(0, -1) : orders;
  const nextCursor = hasMore ? items[items.length - 1].id : null;

  return {
    orders: items,
    nextCursor,
  };
}

export async function getDesignerAttributedOrders(
  designerId: string,
  options: { limit?: number; cursor?: string } = {}
) {
  const { limit = 20, cursor } = options;

  const orders = await prisma.order.findMany({
    where: {
      attributedDesignerId: designerId,
    },
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
    cursor: cursor ? { id: cursor } : undefined,
    include: {
      items: {
        include: {
          product: {
            select: { id: true, name: true, imageUrl: true },
          },
        },
      },
      vendor: {
        select: { id: true, name: true },
      },
    },
  });

  const hasMore = orders.length > limit;
  const items = hasMore ? orders.slice(0, -1) : orders;
  const nextCursor = hasMore ? items[items.length - 1].id : null;

  return {
    orders: items,
    nextCursor,
  };
}

export async function updateOrderStatus(orderId: string, status: OrderStatus) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
  });

  if (!order) {
    throw new Error('Order not found');
  }

  // Validate status transitions
  const validTransitions: Record<OrderStatus, OrderStatus[]> = {
    [OrderStatus.PENDING]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
    [OrderStatus.CONFIRMED]: [OrderStatus.PROCESSING, OrderStatus.CANCELLED],
    [OrderStatus.PROCESSING]: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
    [OrderStatus.SHIPPED]: [OrderStatus.DELIVERED],
    [OrderStatus.DELIVERED]: [OrderStatus.COMPLETED, OrderStatus.RETURNED],
    [OrderStatus.COMPLETED]: [],
    [OrderStatus.CANCELLED]: [],
    [OrderStatus.RETURNED]: [],
  };

  if (!validTransitions[order.status]?.includes(status)) {
    throw new Error(`Invalid status transition from ${order.status} to ${status}`);
  }

  // If transitioning to COMPLETED, trigger credit earning
  if (status === OrderStatus.COMPLETED) {
    return completeOrder(orderId);
  }

  // If transitioning to CANCELLED, handle refunds
  if (status === OrderStatus.CANCELLED) {
    return cancelOrder(orderId);
  }

  return prisma.order.update({
    where: { id: orderId },
    data: { status },
  });
}
