export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import {
  getVendorTierInfo,
  getVendorSubscriptionHistory,
  VENDOR_TIER_FEATURES,
} from '@/lib/authz/vendorTier';

/**
 * GET /api/vendor/subscription
 * Get current vendor tier and subscription status
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Find vendor organization for this user
    const orgUser = await prisma.organizationUser.findFirst({
      where: {
        userId: session.user.id,
        isActive: true,
        organization: { type: 'VENDOR' },
      },
      include: { organization: true },
    });

    if (!orgUser) {
      return NextResponse.json(
        { error: 'No vendor organization found' },
        { status: 404 }
      );
    }

    const organizationId = orgUser.organizationId;

    // Get tier info and subscription history
    const [tierInfo, subscriptionHistory] = await Promise.all([
      getVendorTierInfo(organizationId),
      getVendorSubscriptionHistory(organizationId),
    ]);

    if (!tierInfo) {
      return NextResponse.json(
        { error: 'Unable to get tier information' },
        { status: 500 }
      );
    }

    // Get current active subscription
    const activeSubscription = subscriptionHistory.find(
      (s) => !s.cancelledAt && (!s.expiresAt || s.expiresAt > new Date())
    );

    return NextResponse.json({
      organization: {
        id: organizationId,
        name: orgUser.organization.name,
      },
      tier: {
        current: tierInfo.tier,
        startedAt: tierInfo.startedAt,
        expiresAt: tierInfo.expiresAt,
        isExpired: tierInfo.isExpired,
        isActive: tierInfo.isActive,
      },
      subscription: activeSubscription
        ? {
            id: activeSubscription.id,
            tier: activeSubscription.tier,
            startedAt: activeSubscription.startedAt,
            expiresAt: activeSubscription.expiresAt,
            stripeSubscriptionId: activeSubscription.stripeSubscriptionId,
          }
        : null,
      features: VENDOR_TIER_FEATURES[tierInfo.tier],
      availableTiers: VENDOR_TIER_FEATURES,
    });
  } catch (error) {
    console.error('Error fetching subscription:', error);
    return NextResponse.json(
      { error: 'Failed to fetch subscription' },
      { status: 500 }
    );
  }
}
