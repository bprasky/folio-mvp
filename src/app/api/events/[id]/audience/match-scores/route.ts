import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/events/[id]/audience/match-scores
 * Get vendor-product match scores for designers
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

    const url = new URL(request.url);
    const vendorId = url.searchParams.get('vendorId');
    const productId = url.searchParams.get('productId');
    const minScore = parseFloat(url.searchParams.get('minScore') || '0.5');
    const limit = parseInt(url.searchParams.get('limit') || '50');

    // Verify event exists
    const event = await prisma.event.findUnique({
      where: { id: params.id },
    });

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const where: any = {
      eventId: params.id,
      overallMatchScore: { gte: minScore },
    };

    if (vendorId) {
      where.vendorId = vendorId;
    }

    if (productId) {
      where.productId = productId;
    }

    const matchScores = await prisma.vendorProductMatchScore.findMany({
      where,
      orderBy: { overallMatchScore: 'desc' },
      take: limit,
      include: {
        designer: {
          select: {
            id: true,
            email: true,
            name: true,
            profileImage: true,
            location: true,
            specialties: true,
            budgetRange: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      count: matchScores.length,
      matchScores: matchScores.map((score) => ({
        designer: score.designer,
        scores: {
          style: score.styleMatchScore,
          project: score.projectMatchScore,
          budget: score.budgetMatchScore,
          location: score.locationMatchScore,
          overall: score.overallMatchScore,
        },
        signals: {
          hasViewed: score.hasViewed,
          hasSaved: score.hasSaved,
          hasTagged: score.hasTagged,
        },
        vendorId: score.vendorId,
        productId: score.productId,
      })),
    });
  } catch (error: any) {
    console.error('Error fetching match scores:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}




