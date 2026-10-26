import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

/**
 * GET /api/rep-contacts
 * Fetch rep contact for a specific vendor
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string })?.id;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const vendorName = searchParams.get('vendorName');

    if (!vendorName) {
      return NextResponse.json({ error: 'vendorName is required' }, { status: 400 });
    }

    // Look for exact match first, then case-insensitive
    let contact = await prisma.vendorRepContact.findFirst({
      where: {
        userId,
        vendorName: vendorName,
      },
    });

    // Try case-insensitive if no exact match
    if (!contact) {
      contact = await prisma.vendorRepContact.findFirst({
        where: {
          userId,
          vendorName: {
            equals: vendorName,
            mode: 'insensitive',
          },
        },
      });
    }

    return NextResponse.json({ contact });
  } catch (error) {
    console.error('Failed to fetch rep contact:', error);
    return NextResponse.json(
      { error: 'Failed to fetch rep contact' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/rep-contacts
 * Create or update a rep contact
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string })?.id;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const {
      vendorName,
      repName,
      repEmail,
      repPhone,
      repTitle,
      preferredContact,
      notes,
      hasTradeAccount,
      tradeAccountNumber,
      tradeDiscount,
    } = body;

    if (!vendorName || !repName) {
      return NextResponse.json(
        { error: 'vendorName and repName are required' },
        { status: 400 }
      );
    }

    // Upsert - create or update if exists
    const contact = await prisma.vendorRepContact.upsert({
      where: {
        userId_vendorName: {
          userId,
          vendorName,
        },
      },
      update: {
        repName,
        repEmail: repEmail || null,
        repPhone: repPhone || null,
        repTitle: repTitle || null,
        preferredContact: preferredContact || null,
        notes: notes || null,
        hasTradeAccount: hasTradeAccount || false,
        tradeAccountNumber: tradeAccountNumber || null,
        tradeDiscount: tradeDiscount ? parseFloat(tradeDiscount) : null,
      },
      create: {
        userId,
        vendorName,
        repName,
        repEmail: repEmail || null,
        repPhone: repPhone || null,
        repTitle: repTitle || null,
        preferredContact: preferredContact || null,
        notes: notes || null,
        hasTradeAccount: hasTradeAccount || false,
        tradeAccountNumber: tradeAccountNumber || null,
        tradeDiscount: tradeDiscount ? parseFloat(tradeDiscount) : null,
      },
    });

    return NextResponse.json({ contact });
  } catch (error) {
    console.error('Failed to save rep contact:', error);
    return NextResponse.json(
      { error: 'Failed to save rep contact' },
      { status: 500 }
    );
  }
}
