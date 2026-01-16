export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createPendingCredit } from '@/lib/commerce/credits';

/**
 * GET /api/commerce/orders/[id]
 * Get a single order by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        purchaserUser: {
          select: { id: true, name: true, email: true },
        },
        attributedDesigner: {
          select: { id: true, name: true, email: true },
        },
        attributedRep: {
          select: { id: true, name: true, email: true },
        },
        vendorOrg: {
          select: { id: true, name: true },
        },
        project: {
          select: { id: true, title: true },
        },
        tradeAccount: {
          select: { id: true, accountName: true, accountType: true },
        },
        items: {
          include: {
            product: {
              select: { id: true, name: true, imageUrl: true },
            },
          },
        },
      },
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Check if user has access to this order
    const userId = session.user.id;
    const hasAccess =
      order.purchaserUserId === userId ||
      order.attributedDesignerId === userId ||
      order.attributedRepId === userId;

    // Also check if user is admin
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (!hasAccess && user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({
      ok: true,
      order,
    });
  } catch (error: any) {
    console.error('[commerce/orders/[id]][GET]', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

/**
 * PATCH /api/commerce/orders/[id]
 * Update order status and trigger credit allocation on delivery
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;
    const body = await request.json();
    const { status, vendorOrderRef, trackingNumber, trackingUrl, internalNotes } = body;

    // Verify user is admin or has permission to update
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    if (user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Only admins can update order status' }, { status: 403 });
    }

    const order = await prisma.order.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        attributedDesignerId: true,
        attributedRepId: true,
        designerCreditCents: true,
        repCreditCents: true,
      },
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Build update data
    const updateData: any = {};
    if (status) updateData.status = status;
    if (vendorOrderRef) updateData.vendorOrderRef = vendorOrderRef;
    if (trackingNumber) updateData.trackingNumber = trackingNumber;
    if (trackingUrl) updateData.trackingUrl = trackingUrl;
    if (internalNotes !== undefined) updateData.internalNotes = internalNotes;

    // Set timestamps based on status changes
    const now = new Date();
    if (status === 'CONFIRMED' && order.status === 'PENDING') {
      updateData.confirmedAt = now;
    } else if (status === 'SHIPPED' && order.status !== 'SHIPPED') {
      updateData.shippedAt = now;
    } else if (status === 'DELIVERED' && order.status !== 'DELIVERED') {
      updateData.deliveredAt = now;
    } else if (status === 'CANCELLED') {
      updateData.cancelledAt = now;
    }

    // Update order in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Update the order
      const updatedOrder = await tx.order.update({
        where: { id },
        data: updateData,
      });

      // On DELIVERED status, create pending credits for designer and rep
      // Credits will become available after 30-day hold period
      if (status === 'DELIVERED' && order.status !== 'DELIVERED') {
        const availableAt = new Date();
        availableAt.setDate(availableAt.getDate() + 30); // 30-day hold

        // Create designer credit if applicable
        if (order.attributedDesignerId && order.designerCreditCents > 0) {
          await createPendingCredit(tx, {
            userId: order.attributedDesignerId,
            amountCents: order.designerCreditCents,
            sourceType: 'DESIGNER_COMMISSION',
            sourceOrderId: order.id,
            availableAt,
            description: `Commission from order #${order.id.slice(-8)}`,
          });
        }

        // Create rep credit if applicable
        if (order.attributedRepId && order.repCreditCents > 0) {
          await createPendingCredit(tx, {
            userId: order.attributedRepId,
            amountCents: order.repCreditCents,
            sourceType: 'REP_ATTRIBUTION',
            sourceOrderId: order.id,
            availableAt,
            description: `Rep attribution from order #${order.id.slice(-8)}`,
          });
        }
      }

      // On CANCELLED or RETURNED, we may need to reverse credits
      if ((status === 'CANCELLED' || status === 'RETURNED') && order.status === 'DELIVERED') {
        // Find and adjust any pending credits from this order
        const pendingTxns = await tx.creditTransaction.findMany({
          where: {
            sourceOrderId: order.id,
            type: 'EARN',
            processedAt: null,
          },
          include: { account: true },
        });

        for (const txn of pendingTxns) {
          // Mark transaction as expired
          await tx.creditTransaction.update({
            where: { id: txn.id },
            data: {
              type: 'EXPIRE',
              processedAt: now,
              description: `Order ${status.toLowerCase()} - credit cancelled`,
            },
          });

          // Reduce pending balance
          await tx.creditAccount.update({
            where: { id: txn.accountId },
            data: {
              pendingBalance: { decrement: Number(txn.amount) },
            },
          });
        }
      }

      return updatedOrder;
    });

    return NextResponse.json({
      ok: true,
      order: result,
    });
  } catch (error: any) {
    console.error('[commerce/orders/[id]][PATCH]', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
