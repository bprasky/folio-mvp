export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/vendor/smart-invites
 * Returns recommended designers for a vendor based on:
 * - Designers who follow the vendor
 * - Designers who have saved/tagged vendor products
 * - Designers near event location (if eventId provided)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const vendorId = searchParams.get('vendorId') || session.user.id;
    const eventId = searchParams.get('eventId');

    // Get vendor's products
    const vendorProducts = await prisma.product.findMany({
      where: { vendorId },
      select: { id: true },
    });
    const productIds = vendorProducts.map(p => p.id);

    // Find designers who have saved/tagged vendor products
    const designersWithSaves = await prisma.selection.findMany({
      where: {
        vendorProductId: { in: productIds },
      },
      select: {
        project: {
          select: {
            ownerId: true,
            designerId: true,
          },
        },
      },
      distinct: ['projectId'],
    });

    // Get unique designer IDs
    const designerIds = new Set<string>();
    designersWithSaves.forEach(sel => {
      if (sel.project.ownerId) designerIds.add(sel.project.ownerId);
      if (sel.project.designerId) designerIds.add(sel.project.designerId);
    });

    // If eventId provided, also check EventDesignerEdge for designers who engaged with the event
    if (eventId) {
      const eventDesigners = await prisma.eventDesignerEdge.findMany({
        where: {
          eventId,
          edgeType: { in: ['rsvp_yes', 'attended', 'engaged', 'saved_product'] },
        },
        select: { designerId: true },
        distinct: ['designerId'],
      });
      eventDesigners.forEach(edge => {
        if (edge.designerId) designerIds.add(edge.designerId);
      });
    }

    // Fetch designer details
    const designers = await prisma.user.findMany({
      where: {
        id: { in: Array.from(designerIds) },
        role: 'DESIGNER',
      },
      select: {
        id: true,
        name: true,
        email: true,
        location: true,
        companyName: true,
      },
      take: 10,
    });

    // Calculate match scores and reasons
    const recommendedDesigners = await Promise.all(
      designers.map(async (designer) => {
        // Count how many vendor products this designer has saved
        const savedCount = await prisma.selection.count({
          where: {
            project: {
              OR: [
                { ownerId: designer.id },
                { designerId: designer.id },
              ],
            },
            vendorProductId: { in: productIds },
          },
        });

        // Check if designer has projects in vendor's region (if location exists)
        const locationMatch = designer.location ? 1 : 0;

        // Calculate match score (0-100)
        const matchScore = Math.min(100, Math.round(
          (savedCount * 15) + // 15 points per saved product
          (locationMatch * 20) + // 20 points for location match
          (eventId ? 10 : 0) // 10 points if engaged with event
        ));

        // Determine reason
        let reason = 'Engaged with your products';
        if (savedCount > 5) {
          reason = 'Frequently saves your products';
        } else if (savedCount > 0) {
          reason = 'Has saved your products';
        } else if (eventId) {
          reason = 'Engaged with your event';
        }

        return {
          id: designer.id,
          name: designer.name || 'Designer',
          email: designer.email,
          location: designer.location || undefined,
          companyName: designer.companyName || undefined,
          reason,
          matchScore,
        };
      })
    );

    // Sort by match score
    recommendedDesigners.sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));

    return NextResponse.json({
      designers: recommendedDesigners.slice(0, 5), // Top 5
    });
  } catch (error: any) {
    console.error('[smart-invites] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch recommendations', details: error.message },
      { status: 500 }
    );
  }
}




