export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/products/[productId]/vendor-insights
 * Returns real engagement metrics for a product.
 * Auth-gated: only vendor owner or admin can access.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { productId: string } }
) {
  try {
    const resolvedParams = params instanceof Promise ? await params : params;
    const productId = resolvedParams.productId;

    // Auth check
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify product exists and check ownership
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, vendorId: true },
    });

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    const userRole = (session.user as any).role;
    const isVendorOwner = userRole === 'VENDOR' && product.vendorId === session.user.id;
    const isAdmin = userRole === 'ADMIN';

    if (!isVendorOwner && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Fetch real metrics in parallel
    const [savesCount, tagsWithImages] = await Promise.all([
      prisma.save.count({ where: { productId } }),
      prisma.productTag.findMany({
        where: { productId },
        select: {
          id: true,
          image: {
            select: {
              room: true,
              project: {
                select: {
                  city: true,
                  regionState: true,
                  designer: {
                    select: { location: true },
                  },
                },
              },
            },
          },
        },
      }),
    ]);

    const tagsCount = tagsWithImages.length;
    const saveToTagPct = savesCount > 0 ? Math.round((tagsCount / savesCount) * 100) : 0;

    // Aggregate top rooms
    const roomCounts: Record<string, number> = {};
    for (const tag of tagsWithImages) {
      const room = tag.image?.room;
      if (room) {
        roomCounts[room] = (roomCounts[room] || 0) + 1;
      }
    }
    const topRooms = Object.entries(roomCounts)
      .map(([label, count]) => ({ label, pct: tagsCount > 0 ? Math.round((count / tagsCount) * 100) : 0 }))
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 3);

    // Aggregate top markets
    const marketCounts: Record<string, number> = {};
    for (const tag of tagsWithImages) {
      const project = tag.image?.project;
      const location = project?.city || project?.designer?.location;
      if (location) {
        // Extract city/metro from location string
        const city = location.split(',')[0].trim();
        marketCounts[city] = (marketCounts[city] || 0) + 1;
      }
    }
    const topMarkets = Object.entries(marketCounts)
      .map(([city, count]) => ({ city, pct: tagsCount > 0 ? Math.round((count / tagsCount) * 100) : 0 }))
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 3);

    return NextResponse.json({
      saves: savesCount,
      tags: tagsCount,
      saveToTagPct,
      topRooms,
      topMarkets,
    });
  } catch (error) {
    console.error('[products/[productId]/vendor-insights] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch vendor insights' },
      { status: 500 }
    );
  }
}
