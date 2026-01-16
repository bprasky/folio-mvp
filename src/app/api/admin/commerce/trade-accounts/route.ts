export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/admin/commerce/trade-accounts
 * List all vendor trade accounts (admin only)
 */
export async function GET(request: NextRequest) {
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

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '20', 10);
    const vendorOrgId = searchParams.get('vendorOrgId');
    const accountType = searchParams.get('accountType');
    const isActive = searchParams.get('isActive');

    // Build where clause
    const where: any = {};
    if (vendorOrgId) where.vendorOrgId = vendorOrgId;
    if (accountType) where.accountType = accountType;
    if (isActive !== null && isActive !== undefined) {
      where.isActive = isActive === 'true';
    }

    const total = await prisma.vendorTradeAccount.count({ where });

    const accounts = await prisma.vendorTradeAccount.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        accountName: true,
        accountType: true,
        loginUrl: true,
        discountPercent: true,
        paymentTerms: true,
        minOrderCents: true,
        maxOrderCents: true,
        repName: true,
        repEmail: true,
        repPhone: true,
        isActive: true,
        lastVerifiedAt: true,
        verificationStatus: true,
        verificationNotes: true,
        createdAt: true,
        updatedAt: true,
        vendorOrg: {
          select: {
            id: true,
            name: true,
            logo: true,
          },
        },
        _count: {
          select: {
            orders: true,
          },
        },
      },
    });

    // Format response (redact sensitive fields)
    const formattedAccounts = accounts.map((account) => ({
      ...account,
      discountPercent: Number(account.discountPercent),
      // Don't expose credentials
      hasCredentials: !!(account.loginUrl),
    }));

    return NextResponse.json({
      ok: true,
      accounts: formattedAccounts,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error: any) {
    console.error('[admin/commerce/trade-accounts][GET]', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

/**
 * POST /api/admin/commerce/trade-accounts
 * Create a new vendor trade account (admin only)
 */
export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const {
      vendorOrgId,
      accountName,
      accountType,
      loginUrl,
      username,
      password,
      apiKey,
      apiEndpoint,
      discountPercent,
      paymentTerms,
      minOrderCents,
      maxOrderCents,
      repName,
      repEmail,
      repPhone,
    } = body;

    // Validate required fields
    if (!vendorOrgId || !accountName || !accountType || discountPercent === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: vendorOrgId, accountName, accountType, discountPercent' },
        { status: 400 }
      );
    }

    // Validate account type
    const validTypes = ['LOGIN', 'QUOTE', 'REP', 'API'];
    if (!validTypes.includes(accountType)) {
      return NextResponse.json(
        { error: `Invalid account type. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // Verify vendor org exists
    const vendorOrg = await prisma.organization.findUnique({
      where: { id: vendorOrgId },
      select: { id: true, type: true },
    });

    if (!vendorOrg) {
      return NextResponse.json({ error: 'Vendor organization not found' }, { status: 404 });
    }

    // Check for duplicate account name for this vendor
    const existing = await prisma.vendorTradeAccount.findUnique({
      where: {
        vendorOrgId_accountName: {
          vendorOrgId,
          accountName,
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'An account with this name already exists for this vendor' },
        { status: 409 }
      );
    }

    // Create the trade account
    // NOTE: In production, credentials should be encrypted before storage
    const account = await prisma.vendorTradeAccount.create({
      data: {
        vendorOrgId,
        accountName,
        accountType: accountType as any,
        loginUrl,
        username,
        password, // TODO: Encrypt in production
        apiKey,   // TODO: Encrypt in production
        apiEndpoint,
        discountPercent,
        paymentTerms,
        minOrderCents,
        maxOrderCents,
        repName,
        repEmail,
        repPhone,
        isActive: true,
        verificationStatus: 'PENDING',
      },
      select: {
        id: true,
        accountName: true,
        accountType: true,
        discountPercent: true,
        isActive: true,
        createdAt: true,
        vendorOrg: {
          select: { id: true, name: true },
        },
      },
    });

    return NextResponse.json({
      ok: true,
      account: {
        ...account,
        discountPercent: Number(account.discountPercent),
      },
    });
  } catch (error: any) {
    console.error('[admin/commerce/trade-accounts][POST]', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
