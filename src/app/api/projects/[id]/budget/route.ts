export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/projects/[id]/budget
 * Compute budget summary from ProjectProductPricing + Selection data.
 * Query params: markup (default 30)
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
    const markupPercent = parseInt(searchParams.get('markup') || '30', 10);

    // Get all pricing entries for this project
    const pricing = await prisma.projectProductPricing.findMany({
      where: { projectId: params.id },
      include: {
        product: { select: { id: true, name: true, brand: true, category: true } },
      },
    });

    // Get all selections for room context
    const selections = await prisma.selection.findMany({
      where: { projectId: params.id },
      include: {
        room: { select: { id: true, name: true } },
      },
    });

    // Get rooms
    const rooms = await prisma.room.findMany({
      where: { projectId: params.id },
      select: { id: true, name: true },
    });

    // Build room map
    const roomMap = new Map(rooms.map(r => [r.id, r.name]));

    // Calculate totals
    let tradeCost = 0;
    let pricedCount = 0;
    const totalCount = selections.length;
    const byRoomMap = new Map<string, { tradeCost: number; pricedCount: number; totalCount: number }>();
    const byVendorMap = new Map<string, { productCount: number; pricedCount: number; tradeCost: number }>();

    // Initialize rooms
    for (const room of rooms) {
      byRoomMap.set(room.id, { tradeCost: 0, pricedCount: 0, totalCount: 0 });
    }

    // Count selections per room
    for (const sel of selections) {
      if (sel.roomId) {
        const room = byRoomMap.get(sel.roomId);
        if (room) room.totalCount++;
      }
      // Count by vendor
      const vendor = sel.vendorName || 'Unknown';
      if (!byVendorMap.has(vendor)) {
        byVendorMap.set(vendor, { productCount: 0, pricedCount: 0, tradeCost: 0 });
      }
      byVendorMap.get(vendor)!.productCount++;
    }

    // Aggregate pricing
    for (const p of pricing) {
      const price = p.unitPriceTrade ? Number(p.unitPriceTrade) : 0;
      const qty = p.quantity || 1;
      const lineTotal = price * qty;

      if (p.status === 'RECEIVED' && price > 0) {
        pricedCount++;
        tradeCost += lineTotal;

        if (p.roomId) {
          const room = byRoomMap.get(p.roomId);
          if (room) {
            room.pricedCount++;
            room.tradeCost += lineTotal;
          }
        }

        const vendor = p.product.brand || 'Unknown';
        const vendorData = byVendorMap.get(vendor);
        if (vendorData) {
          vendorData.pricedCount++;
          vendorData.tradeCost += lineTotal;
        }
      }
    }

    const clientPrice = tradeCost * (1 + markupPercent / 100);
    const margin = clientPrice - tradeCost;

    const byRoom = rooms.map(room => {
      const data = byRoomMap.get(room.id) || { tradeCost: 0, pricedCount: 0, totalCount: 0 };
      return {
        roomId: room.id,
        roomName: room.name,
        tradeCost: data.tradeCost,
        pricedCount: data.pricedCount,
        totalCount: data.totalCount,
        percentPriced: data.totalCount > 0 ? Math.round((data.pricedCount / data.totalCount) * 100) : 0,
      };
    });

    const byVendor = Array.from(byVendorMap.entries())
      .map(([vendorName, data]) => ({
        vendorName,
        productCount: data.productCount,
        pricedCount: data.pricedCount,
        tradeCost: data.tradeCost,
        status: data.pricedCount === 0 ? 'not_requested' as const
          : data.pricedCount === data.productCount ? 'all_priced' as const
          : 'partial' as const,
      }))
      .sort((a, b) => b.tradeCost - a.tradeCost);

    return NextResponse.json({
      tradeCost,
      clientPrice,
      margin,
      pricedCount,
      totalCount,
      markupPercent,
      byRoom,
      byVendor,
    });
  } catch (error) {
    console.error('[API] budget GET error:', error);
    return NextResponse.json({ error: 'Failed to compute budget' }, { status: 500 });
  }
}
