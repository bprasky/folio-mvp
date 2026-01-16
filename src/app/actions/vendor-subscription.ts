'use server';

/**
 * Vendor Subscription Server Actions
 *
 * Server actions for managing vendor subscriptions, tier upgrades,
 * and subscription lifecycle.
 */

import { prisma } from '@/lib/prisma';
import type { VendorTier } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { VENDOR_TIERS, type VendorTierSlug } from '@/lib/vendor/tiers';

/**
 * Create a default STARTER subscription for a vendor organization
 * Called when a vendor claims their profile
 */
export async function createVendorSubscription(organizationId: string) {
  // Check if subscription already exists
  const existing = await prisma.vendorSubscription.findUnique({
    where: { organizationId },
  });

  if (existing) return existing;

  // Create new STARTER subscription
  return prisma.vendorSubscription.create({
    data: {
      organizationId,
      tier: 'STARTER',
      affiliateFeePercent: VENDOR_TIERS.STARTER.affiliateFeePercent,
      repSeatLimit: VENDOR_TIERS.STARTER.repSeatLimit,
      skuLimit: VENDOR_TIERS.STARTER.skuLimit,
      status: 'ACTIVE',
    },
  });
}

/**
 * Upgrade vendor to a new tier
 */
export async function upgradeVendorTier(
  organizationId: string,
  newTier: VendorTier,
  stripeSubscriptionId?: string
) {
  const config = VENDOR_TIERS[newTier as VendorTierSlug];

  // Ensure subscription exists
  let subscription = await prisma.vendorSubscription.findUnique({
    where: { organizationId },
  });

  if (!subscription) {
    // Create subscription first
    subscription = await createVendorSubscription(organizationId);
  }

  // Update to new tier
  const updated = await prisma.vendorSubscription.update({
    where: { organizationId },
    data: {
      tier: newTier,
      affiliateFeePercent: config.affiliateFeePercent ?? 5, // default 5% for enterprise
      repSeatLimit: config.repSeatLimit ?? 999, // high number for enterprise
      skuLimit: config.skuLimit,
      stripeSubscriptionId,
      status: 'ACTIVE',
      priceMonthly: config.priceMonthly,
    },
  });

  // Also update the vendorTier on the Organization model for backward compatibility
  await prisma.organization.update({
    where: { id: organizationId },
    data: { vendorTier: newTier },
  });

  revalidatePath('/vendor');
  revalidatePath('/vendor/settings');

  return updated;
}

/**
 * Start a trial for a vendor
 */
export async function startVendorTrial(
  organizationId: string,
  tier: VendorTier,
  trialDays: number = 14
) {
  const config = VENDOR_TIERS[tier as VendorTierSlug];
  const trialEndsAt = new Date();
  trialEndsAt.setDate(trialEndsAt.getDate() + trialDays);

  // Ensure subscription exists
  let subscription = await prisma.vendorSubscription.findUnique({
    where: { organizationId },
  });

  if (!subscription) {
    subscription = await createVendorSubscription(organizationId);
  }

  const updated = await prisma.vendorSubscription.update({
    where: { organizationId },
    data: {
      tier,
      affiliateFeePercent: config.affiliateFeePercent ?? 5,
      repSeatLimit: config.repSeatLimit ?? 999,
      skuLimit: config.skuLimit,
      status: 'TRIALING',
      trialEndsAt,
      priceMonthly: config.priceMonthly,
    },
  });

  // Update Organization vendorTier for backward compatibility
  await prisma.organization.update({
    where: { id: organizationId },
    data: { vendorTier: tier },
  });

  revalidatePath('/vendor');

  return updated;
}

/**
 * Cancel vendor subscription (downgrade to STARTER)
 */
export async function cancelVendorSubscription(organizationId: string) {
  const updated = await prisma.vendorSubscription.update({
    where: { organizationId },
    data: {
      tier: 'STARTER',
      affiliateFeePercent: VENDOR_TIERS.STARTER.affiliateFeePercent,
      repSeatLimit: VENDOR_TIERS.STARTER.repSeatLimit,
      skuLimit: VENDOR_TIERS.STARTER.skuLimit,
      stripeSubscriptionId: null,
      canceledAt: new Date(),
      status: 'CANCELED',
      priceMonthly: 0,
    },
  });

  // Update Organization vendorTier for backward compatibility
  await prisma.organization.update({
    where: { id: organizationId },
    data: { vendorTier: 'STARTER' },
  });

  revalidatePath('/vendor');
  revalidatePath('/vendor/settings');

  return updated;
}

/**
 * Pause vendor subscription
 */
export async function pauseVendorSubscription(organizationId: string) {
  const updated = await prisma.vendorSubscription.update({
    where: { organizationId },
    data: {
      status: 'PAUSED',
    },
  });

  revalidatePath('/vendor');

  return updated;
}

/**
 * Resume a paused subscription
 */
export async function resumeVendorSubscription(organizationId: string) {
  const updated = await prisma.vendorSubscription.update({
    where: { organizationId },
    data: {
      status: 'ACTIVE',
    },
  });

  revalidatePath('/vendor');

  return updated;
}

/**
 * Update Stripe billing details
 */
export async function updateVendorBilling(
  organizationId: string,
  data: {
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
    billingEmail?: string;
    currentPeriodStart?: Date;
    currentPeriodEnd?: Date;
  }
) {
  const updated = await prisma.vendorSubscription.update({
    where: { organizationId },
    data: {
      stripeCustomerId: data.stripeCustomerId,
      stripeSubscriptionId: data.stripeSubscriptionId,
      billingEmail: data.billingEmail,
      currentPeriodStart: data.currentPeriodStart,
      currentPeriodEnd: data.currentPeriodEnd,
    },
  });

  return updated;
}

/**
 * Handle subscription payment failure
 */
export async function handlePaymentFailure(organizationId: string) {
  const updated = await prisma.vendorSubscription.update({
    where: { organizationId },
    data: {
      status: 'PAST_DUE',
    },
  });

  revalidatePath('/vendor');

  return updated;
}

/**
 * Set custom enterprise terms
 */
export async function setEnterpriseTerms(
  organizationId: string,
  terms: {
    affiliateFeePercent: number;
    repSeatLimit?: number;
    priceMonthly?: number;
  }
) {
  // Ensure they're on enterprise tier first
  const subscription = await prisma.vendorSubscription.findUnique({
    where: { organizationId },
  });

  if (subscription?.tier !== 'ENTERPRISE') {
    throw new Error('Organization must be on Enterprise tier to set custom terms');
  }

  const updated = await prisma.vendorSubscription.update({
    where: { organizationId },
    data: {
      affiliateFeePercent: terms.affiliateFeePercent,
      repSeatLimit: terms.repSeatLimit ?? 999,
      priceMonthly: terms.priceMonthly,
    },
  });

  revalidatePath('/vendor');

  return updated;
}

/**
 * Get subscription with organization details
 */
export async function getVendorSubscriptionWithOrg(organizationId: string) {
  return prisma.vendorSubscription.findUnique({
    where: { organizationId },
    include: {
      organization: {
        select: {
          id: true,
          name: true,
          type: true,
          status: true,
        },
      },
    },
  });
}
