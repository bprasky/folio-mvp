export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { seedRepShadowFromInvite } from '@/lib/intelligence/shadow-profiles';

/**
 * GET /api/projects/[id]/pricing
 * Fetch all pricing entries for a project.
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

    const { searchParams } = new URL(request.url);
    const roomId = searchParams.get('roomId');

    const pricing = await prisma.projectProductPricing.findMany({
      where: {
        projectId: params.id,
        ...(roomId ? { roomId } : {}),
      },
      orderBy: { updatedAt: 'desc' },
    });

    // Convert Decimal to number for JSON serialization
    const entries = pricing.map(p => ({
      ...p,
      unitPriceTrade: p.unitPriceTrade ? Number(p.unitPriceTrade) : null,
      unitPriceRetail: p.unitPriceRetail ? Number(p.unitPriceRetail) : null,
      comYardage: p.comYardage ? Number(p.comYardage) : null,
    }));

    return NextResponse.json({ entries });
  } catch (error) {
    console.error('[API] pricing GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch pricing' }, { status: 500 });
  }
}

/**
 * POST /api/projects/[id]/pricing
 * Create or update a pricing entry (manual quote entry).
 * Body: { productId, roomId?, unitPriceTrade?, leadTimeWeeks?, validThrough?, notes? }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { productId, roomId, unitPriceTrade, unitPriceRetail, quantity, leadTimeWeeks, availability, availabilityNote, validThrough, quoteSource, quotedByName, quotedByEmail, vendorName } = body;

    if (!productId) {
      return NextResponse.json({ error: 'productId is required' }, { status: 400 });
    }

    const entry = await prisma.projectProductPricing.upsert({
      where: {
        projectId_productId_roomId: {
          projectId: params.id,
          productId,
          roomId: roomId || null,
        },
      },
      create: {
        projectId: params.id,
        productId,
        roomId: roomId || null,
        unitPriceTrade: unitPriceTrade != null ? unitPriceTrade : undefined,
        unitPriceRetail: unitPriceRetail != null ? unitPriceRetail : undefined,
        quantity: quantity || 1,
        leadTimeWeeks: leadTimeWeeks != null ? leadTimeWeeks : undefined,
        availability: availability || undefined,
        availabilityNote: availabilityNote || undefined,
        validThrough: validThrough ? new Date(validThrough) : undefined,
        quoteSource: quoteSource || 'MANUAL',
        quotedByName: quotedByName || session.user.name || undefined,
        quotedByEmail: quotedByEmail || undefined,
        quotedAt: unitPriceTrade != null ? new Date() : undefined,
        status: unitPriceTrade != null ? 'RECEIVED' : 'NOT_REQUESTED',
      },
      update: {
        ...(unitPriceTrade != null ? { unitPriceTrade, quotedAt: new Date(), status: 'RECEIVED' } : {}),
        ...(unitPriceRetail != null ? { unitPriceRetail } : {}),
        ...(quantity != null ? { quantity } : {}),
        ...(leadTimeWeeks != null ? { leadTimeWeeks } : {}),
        ...(availability != null ? { availability } : {}),
        ...(availabilityNote != null ? { availabilityNote } : {}),
        ...(validThrough != null ? { validThrough: new Date(validThrough) } : {}),
        ...(quoteSource ? { quoteSource } : {}),
      },
    });

    // Seed RepShadowProfile from manual quote attribution
    if (quotedByName && quotedByEmail && vendorName) {
      const designer = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { location: true },
      });
      seedRepShadowFromInvite({
        vendorName,
        repName: quotedByName,
        repEmail: quotedByEmail,
        designerLocation: designer?.location || undefined,
      }).catch(console.error);
    }

    return NextResponse.json({
      entry: {
        ...entry,
        unitPriceTrade: entry.unitPriceTrade ? Number(entry.unitPriceTrade) : null,
        unitPriceRetail: entry.unitPriceRetail ? Number(entry.unitPriceRetail) : null,
        comYardage: entry.comYardage ? Number(entry.comYardage) : null,
      },
    });
  } catch (error) {
    console.error('[API] pricing POST error:', error);
    return NextResponse.json({ error: 'Failed to save pricing' }, { status: 500 });
  }
}
