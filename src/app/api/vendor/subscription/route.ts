export const dynamic = 'force-dynamic';

/**
 * Vendor Subscription API Route
 *
 * GET /api/vendor/subscription
 * Returns the vendor's subscription tier, status, and accessible features.
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import {
  getVendorSubscription,
  canAccessFeature,
  type VendorFeature,
} from '@/lib/vendor/access';
import { VENDOR_TIERS, type VendorTierSlug } from '@/lib/vendor/tiers';

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get the organization ID - either from operatingAsOrgId or find their vendor org
  let orgId = session.user.operatingAsOrgId;

  if (!orgId) {
    // Try to find a vendor organization they belong to
    const orgMembership = await prisma.organizationUser.findFirst({
      where: {
        userId: session.user.id,
        organization: {
          type: 'VENDOR',
        },
      },
      select: {
        organizationId: true,
      },
    });

    orgId = orgMembership?.organizationId || null;
  }

  if (!orgId) {
    return NextResponse.json({ error: 'Not a vendor' }, { status: 403 });
  }

  const subscription = await getVendorSubscription(orgId);

  // If no subscription exists, return STARTER defaults
  if (!subscription) {
    return NextResponse.json({
      tier: 'STARTER',
      config: VENDOR_TIERS.STARTER,
      subscription: {
        status: 'ACTIVE',
        affiliateFeePercent: VENDOR_TIERS.STARTER.affiliateFeePercent,
        skuLimit: VENDOR_TIERS.STARTER.skuLimit,
        repSeatLimit: VENDOR_TIERS.STARTER.repSeatLimit,
      },
      features: {
        designerProfiles: false,
        fingerprintMatching: false,
        eventAttribution: false,
        trendForecasting: false,
        messaging: false,
        apiAccess: false,
        analyticsDashboard: false,
        skuUploads: false,
        productBoosting: false,
      },
    });
  }

  // Check all feature access in parallel
  const featureList: VendorFeature[] = [
    'designer_profiles',
    'fingerprint_matching',
    'event_attribution',
    'trend_forecasting',
    'messaging',
    'api_access',
    'analytics_dashboard',
    'sku_uploads',
    'product_boosting',
  ];

  const featureChecks = await Promise.all(
    featureList.map((feature) => canAccessFeature(orgId!, feature))
  );

  const features: Record<string, boolean> = {};
  featureList.forEach((feature, index) => {
    // Convert snake_case to camelCase for the response
    const camelKey = feature.replace(/_([a-z])/g, (_, letter) =>
      letter.toUpperCase()
    );
    features[camelKey] = featureChecks[index];
  });

  return NextResponse.json({
    tier: subscription.tier,
    config: VENDOR_TIERS[subscription.tier as VendorTierSlug],
    subscription: {
      status: subscription.status,
      currentPeriodEnd: subscription.currentPeriodEnd,
      trialEndsAt: subscription.trialEndsAt,
      affiliateFeePercent: subscription.affiliateFeePercent,
      skuLimit: subscription.skuLimit,
      repSeatLimit: subscription.repSeatLimit,
    },
    features,
  });
}
