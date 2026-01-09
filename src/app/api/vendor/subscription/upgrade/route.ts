export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { VendorTier } from '@prisma/client';
import {
  upgradeVendorTier,
  getVendorTier,
  TIER_HIERARCHY,
} from '@/lib/authz/vendorTier';

/**
 * POST /api/vendor/subscription/upgrade
 * Initiate an upgrade to a new tier
 *
 * Request body:
 * {
 *   tier: "PRO" | "ENTERPRISE"
 * }
 *
 * In production, this would:
 * 1. Create a Stripe Checkout session
 * 2. Return the checkout URL
 * 3. Webhook handler would complete the upgrade after payment
 *
 * For now (stub), it directly upgrades with a 30-day trial
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { tier } = body as { tier: VendorTier };

    // Validate tier
    if (!tier || !['PRO', 'ENTERPRISE'].includes(tier)) {
      return NextResponse.json(
        { error: 'Invalid tier. Must be PRO or ENTERPRISE' },
        { status: 400 }
      );
    }

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

    // Check user has permission to upgrade (must be OWNER or ADMIN)
    if (!['OWNER', 'ADMIN'].includes(orgUser.role)) {
      return NextResponse.json(
        { error: 'Only organization owners or admins can upgrade' },
        { status: 403 }
      );
    }

    const organizationId = orgUser.organizationId;

    // Check current tier - can only upgrade, not downgrade via this route
    const currentTier = await getVendorTier(organizationId);
    if (TIER_HIERARCHY[currentTier] >= TIER_HIERARCHY[tier]) {
      return NextResponse.json(
        {
          error: `Already at ${currentTier} tier. Cannot upgrade to ${tier}`,
          currentTier,
          requestedTier: tier,
        },
        { status: 400 }
      );
    }

    // Check if feature flag is enabled
    const featureEnabled = process.env.NEXT_PUBLIC_FEATURE_VENDOR_TIERS === 'true';
    if (!featureEnabled) {
      return NextResponse.json(
        { error: 'Vendor tiers feature is not enabled' },
        { status: 403 }
      );
    }

    // In production: Create Stripe checkout session and return URL
    // For now (stub): Direct upgrade with 30-day duration
    //
    // TODO: Implement Stripe integration
    // const stripeSession = await stripe.checkout.sessions.create({
    //   customer_email: session.user.email,
    //   line_items: [{ price: TIER_PRICE_IDS[tier], quantity: 1 }],
    //   mode: 'subscription',
    //   success_url: `${process.env.NEXTAUTH_URL}/vendor/subscription/success`,
    //   cancel_url: `${process.env.NEXTAUTH_URL}/vendor/subscription/cancel`,
    //   metadata: { organizationId, tier },
    // });
    // return NextResponse.json({ checkoutUrl: stripeSession.url });

    // Stub: Direct upgrade
    await upgradeVendorTier(organizationId, tier, {
      durationDays: 30, // 30-day trial
    });

    return NextResponse.json({
      success: true,
      message: `Upgraded to ${tier} tier`,
      tier,
      // In production: checkoutUrl instead
      // checkoutUrl: stripeSession.url,
    });
  } catch (error) {
    console.error('Error initiating upgrade:', error);
    return NextResponse.json(
      { error: 'Failed to initiate upgrade' },
      { status: 500 }
    );
  }
}
