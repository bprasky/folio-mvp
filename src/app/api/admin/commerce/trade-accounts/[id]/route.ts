export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/admin/commerce/trade-accounts/[id]
 * Get a single trade account (admin only)
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

    // Verify admin role
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    if (user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = params;

    const account = await prisma.vendorTradeAccount.findUnique({
      where: { id },
      include: {
        vendorOrg: {
          select: {
            id: true,
            name: true,
            logo: true,
            website: true,
          },
        },
        orders: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            status: true,
            retailAmountCents: true,
            tradeAmountCents: true,
            createdAt: true,
          },
        },
        _count: {
          select: {
            orders: true,
          },
        },
      },
    });

    if (!account) {
      return NextResponse.json({ error: 'Trade account not found' }, { status: 404 });
    }

    // Redact sensitive credentials
    return NextResponse.json({
      ok: true,
      account: {
        id: account.id,
        accountName: account.accountName,
        accountType: account.accountType,
        loginUrl: account.loginUrl,
        apiEndpoint: account.apiEndpoint,
        // Indicate presence of credentials without exposing them
        hasUsername: !!account.username,
        hasPassword: !!account.password,
        hasApiKey: !!account.apiKey,
        discountPercent: Number(account.discountPercent),
        paymentTerms: account.paymentTerms,
        minOrderCents: account.minOrderCents,
        maxOrderCents: account.maxOrderCents,
        repName: account.repName,
        repEmail: account.repEmail,
        repPhone: account.repPhone,
        isActive: account.isActive,
        lastVerifiedAt: account.lastVerifiedAt,
        verificationStatus: account.verificationStatus,
        verificationNotes: account.verificationNotes,
        createdAt: account.createdAt,
        updatedAt: account.updatedAt,
        vendorOrg: account.vendorOrg,
        recentOrders: account.orders,
        totalOrders: account._count.orders,
      },
    });
  } catch (error: any) {
    console.error('[admin/commerce/trade-accounts/[id]][GET]', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/commerce/trade-accounts/[id]
 * Update a trade account (admin only)
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

    // Verify admin role
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    if (user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = params;
    const body = await request.json();

    // Check if account exists
    const existing = await prisma.vendorTradeAccount.findUnique({
      where: { id },
      select: { id: true, vendorOrgId: true, accountName: true },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Trade account not found' }, { status: 404 });
    }

    // Build update data
    const updateData: any = {};
    const allowedFields = [
      'accountName',
      'accountType',
      'loginUrl',
      'username',
      'password',
      'apiKey',
      'apiEndpoint',
      'discountPercent',
      'paymentTerms',
      'minOrderCents',
      'maxOrderCents',
      'repName',
      'repEmail',
      'repPhone',
      'isActive',
      'verificationStatus',
      'verificationNotes',
    ];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    // If account name is changed, check for duplicates
    if (updateData.accountName && updateData.accountName !== existing.accountName) {
      const duplicate = await prisma.vendorTradeAccount.findUnique({
        where: {
          vendorOrgId_accountName: {
            vendorOrgId: existing.vendorOrgId,
            accountName: updateData.accountName,
          },
        },
      });

      if (duplicate) {
        return NextResponse.json(
          { error: 'An account with this name already exists for this vendor' },
          { status: 409 }
        );
      }
    }

    // Update verification timestamp if status changed to VERIFIED
    if (updateData.verificationStatus === 'VERIFIED') {
      updateData.lastVerifiedAt = new Date();
    }

    const updated = await prisma.vendorTradeAccount.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        accountName: true,
        accountType: true,
        discountPercent: true,
        isActive: true,
        verificationStatus: true,
        lastVerifiedAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      ok: true,
      account: {
        ...updated,
        discountPercent: Number(updated.discountPercent),
      },
    });
  } catch (error: any) {
    console.error('[admin/commerce/trade-accounts/[id]][PATCH]', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/commerce/trade-accounts/[id]
 * Delete a trade account (admin only)
 * Only allowed if no orders are associated
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify admin role
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    if (user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = params;

    // Check if account exists and has orders
    const account = await prisma.vendorTradeAccount.findUnique({
      where: { id },
      select: {
        id: true,
        _count: {
          select: { orders: true },
        },
      },
    });

    if (!account) {
      return NextResponse.json({ error: 'Trade account not found' }, { status: 404 });
    }

    if (account._count.orders > 0) {
      return NextResponse.json(
        { error: 'Cannot delete account with associated orders. Deactivate instead.' },
        { status: 400 }
      );
    }

    await prisma.vendorTradeAccount.delete({
      where: { id },
    });

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('[admin/commerce/trade-accounts/[id]][DELETE]', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
