/**
 * Vendor Trade Account Management
 */

import { prisma } from '@/lib/prisma';
import { TradeAccountType } from '@prisma/client';

interface CreateTradeAccountParams {
  vendorId: string;
  accountType: TradeAccountType;
  discountPercent: number;
  paymentTerms?: string;
  loginUrl?: string;
  credentials?: Record<string, string>;
  contactEmail?: string;
  contactPhone?: string;
  defaultRepId?: string;
}

export async function createTradeAccount(params: CreateTradeAccountParams) {
  const {
    vendorId,
    accountType,
    discountPercent,
    paymentTerms,
    loginUrl,
    credentials,
    contactEmail,
    contactPhone,
    defaultRepId,
  } = params;

  // Validate vendor organization exists
  const vendor = await prisma.organization.findUnique({
    where: { id: vendorId },
  });

  if (!vendor) {
    throw new Error('Vendor organization not found');
  }

  // TODO: Encrypt credentials before storing
  const credentialsJson = credentials ? JSON.stringify(credentials) : null;

  return prisma.vendorTradeAccount.create({
    data: {
      vendorId,
      accountType,
      discountPercent,
      paymentTerms,
      loginUrl,
      credentialsJson,
      contactEmail,
      contactPhone,
      defaultRepId,
      isActive: true,
      lastVerifiedAt: new Date(),
    },
  });
}

export async function updateTradeAccount(
  vendorId: string,
  data: Partial<Omit<CreateTradeAccountParams, 'vendorId'>>
) {
  const existing = await prisma.vendorTradeAccount.findUnique({
    where: { vendorId },
  });

  if (!existing) {
    throw new Error('Trade account not found');
  }

  const updateData: Record<string, unknown> = {};

  if (data.accountType !== undefined) {
    updateData.accountType = data.accountType;
  }
  if (data.discountPercent !== undefined) {
    updateData.discountPercent = data.discountPercent;
  }
  if (data.paymentTerms !== undefined) {
    updateData.paymentTerms = data.paymentTerms;
  }
  if (data.loginUrl !== undefined) {
    updateData.loginUrl = data.loginUrl;
  }
  if (data.credentials !== undefined) {
    // TODO: Encrypt credentials before storing
    updateData.credentialsJson = JSON.stringify(data.credentials);
  }
  if (data.contactEmail !== undefined) {
    updateData.contactEmail = data.contactEmail;
  }
  if (data.contactPhone !== undefined) {
    updateData.contactPhone = data.contactPhone;
  }
  if (data.defaultRepId !== undefined) {
    updateData.defaultRepId = data.defaultRepId;
  }

  return prisma.vendorTradeAccount.update({
    where: { vendorId },
    data: updateData,
  });
}

export async function getVendorTradeAccount(vendorId: string) {
  return prisma.vendorTradeAccount.findUnique({
    where: { vendorId },
    include: {
      vendor: true,
      defaultRep: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });
}

export async function updateTradeAccountStatus(vendorId: string, isActive: boolean) {
  return prisma.vendorTradeAccount.update({
    where: { vendorId },
    data: {
      isActive,
      lastVerifiedAt: isActive ? new Date() : undefined,
    },
  });
}

export async function verifyTradeAccount(vendorId: string) {
  return prisma.vendorTradeAccount.update({
    where: { vendorId },
    data: {
      lastVerifiedAt: new Date(),
    },
  });
}

export async function listActiveTradeAccounts() {
  return prisma.vendorTradeAccount.findMany({
    where: { isActive: true },
    include: {
      vendor: {
        select: {
          id: true,
          name: true,
          type: true,
        },
      },
      defaultRep: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
    orderBy: {
      vendor: {
        name: 'asc',
      },
    },
  });
}

export async function listAllTradeAccounts(options: { limit?: number; cursor?: string } = {}) {
  const { limit = 50, cursor } = options;

  const accounts = await prisma.vendorTradeAccount.findMany({
    take: limit + 1,
    cursor: cursor ? { id: cursor } : undefined,
    include: {
      vendor: {
        select: {
          id: true,
          name: true,
          type: true,
        },
      },
      defaultRep: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  const hasMore = accounts.length > limit;
  const items = hasMore ? accounts.slice(0, -1) : accounts;
  const nextCursor = hasMore ? items[items.length - 1].id : null;

  return {
    accounts: items,
    nextCursor,
  };
}

export async function deleteTradeAccount(vendorId: string) {
  // Check if there are any orders associated with this vendor
  const ordersCount = await prisma.order.count({
    where: { vendorId },
  });

  if (ordersCount > 0) {
    throw new Error(
      'Cannot delete trade account with existing orders. Deactivate instead.'
    );
  }

  return prisma.vendorTradeAccount.delete({
    where: { vendorId },
  });
}

export async function getTradeAccountStats(vendorId: string) {
  const account = await prisma.vendorTradeAccount.findUnique({
    where: { vendorId },
  });

  if (!account) {
    return null;
  }

  // Get order statistics
  const [totalOrders, completedOrders, totalRevenue] = await Promise.all([
    prisma.order.count({
      where: { vendorId },
    }),
    prisma.order.count({
      where: {
        vendorId,
        status: 'COMPLETED',
      },
    }),
    prisma.order.aggregate({
      where: {
        vendorId,
        status: 'COMPLETED',
      },
      _sum: {
        retailAmountCents: true,
        marginAmountCents: true,
      },
    }),
  ]);

  return {
    account,
    stats: {
      totalOrders,
      completedOrders,
      totalRevenueCents: totalRevenue._sum.retailAmountCents || 0,
      totalMarginCents: totalRevenue._sum.marginAmountCents || 0,
    },
  };
}
