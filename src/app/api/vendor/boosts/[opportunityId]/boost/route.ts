import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { canVendorBoost, notifyDesignerOfBoost } from '@/lib/boost';

export async function POST(
  request: NextRequest,
  { params }: { params: { opportunityId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { pullQuote, showInArticle = true, showOnVendorPage = true } = await request.json();

    if (!pullQuote || typeof pullQuote !== 'string' || pullQuote.trim().length === 0) {
      return NextResponse.json(
        { error: 'Pull quote is required' },
        { status: 400 }
      );
    }

    // Get the opportunity with vendor info
    const opportunity = await prisma.boostOpportunity.findUnique({
      where: { id: params.opportunityId },
      include: {
        vendor: {
          include: {
            vendorSubscription: {
              select: { tier: true, status: true },
            },
          },
        },
        boost: true,
      },
    });

    if (!opportunity) {
      return NextResponse.json({ error: 'Opportunity not found' }, { status: 404 });
    }

    // Verify user has access to this vendor org
    const userOrg = await prisma.organizationUser.findFirst({
      where: {
        userId: session.user.id,
        organizationId: opportunity.vendorId,
        role: { in: ['OWNER', 'ADMIN'] },
        isActive: true,
      },
    });

    if (!userOrg) {
      return NextResponse.json(
        { error: 'You do not have permission to boost for this vendor' },
        { status: 403 }
      );
    }

    // Verify vendor can boost
    if (!canVendorBoost(opportunity.vendor)) {
      return NextResponse.json(
        { error: 'Upgrade required to boost testimonials' },
        { status: 402 }
      );
    }

    // Check not expired
    if (new Date() > opportunity.expiresAt) {
      return NextResponse.json(
        { error: 'This opportunity has expired' },
        { status: 410 }
      );
    }

    // Check not already boosted
    if (opportunity.status === 'BOOSTED' || opportunity.boost) {
      return NextResponse.json(
        { error: 'This opportunity has already been boosted' },
        { status: 409 }
      );
    }

    // Create the boost
    const boost = await prisma.boost.create({
      data: {
        opportunityId: opportunity.id,
        vendorId: opportunity.vendorId,
        boostedById: session.user.id,
        pullQuote: pullQuote.trim(),
        showInArticle,
        showOnVendorPage,
        boostTier: 'included', // Could be calculated based on plan
      },
    });

    // Update opportunity status
    await prisma.boostOpportunity.update({
      where: { id: opportunity.id },
      data: {
        status: 'BOOSTED',
        respondedAt: new Date(),
      },
    });

    // Notify designer
    try {
      await notifyDesignerOfBoost(opportunity.id, boost.id);
    } catch (notifyError) {
      console.error('[boost/route] Failed to notify designer:', notifyError);
      // Don't fail the request if notification fails
    }

    return NextResponse.json({
      success: true,
      boost: {
        id: boost.id,
        pullQuote: boost.pullQuote,
        showInArticle: boost.showInArticle,
        showOnVendorPage: boost.showOnVendorPage,
      },
    });
  } catch (error) {
    console.error('[boost/route] Error:', error);
    return NextResponse.json(
      { error: 'Failed to boost testimonial' },
      { status: 500 }
    );
  }
}
