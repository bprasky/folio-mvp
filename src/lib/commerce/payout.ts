/**
 * Payout System — Stripe Connect
 *
 * Designers can cash out their Folio credit balance via Stripe Connect.
 * Credits are worth more on-platform (1.2x purchasing power) to incentivize
 * spending within Folio, but can always be cashed out at face value.
 *
 * Platform fee on cash-out: 5% (incentivize on-platform spending)
 * Minimum payout: $25.00
 */

import { prisma } from '@/lib/prisma';

// Platform multiplier: credits are worth 1.2x when spent on Folio
export const PLATFORM_CREDIT_MULTIPLIER = 1.2;

// Cash-out fee: 5% to incentivize platform spending
const CASHOUT_FEE_PERCENT = 5;

// Minimum payout
const MIN_PAYOUT_CENTS = 2500; // $25.00

/**
 * Create a Stripe Connect onboarding link for a designer.
 * Returns the URL to redirect the user to Stripe's onboarding flow.
 */
export async function createStripeConnectOnboarding(userId: string): Promise<{
  url: string | null;
  error?: string;
}> {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return { url: null, error: 'Stripe is not configured. Set STRIPE_SECRET_KEY to enable payouts.' };
    }

    // Dynamic import — stripe package is optional, only needed when payouts are enabled
    let stripe: any;
    try {
      const Stripe = (await import(/* webpackIgnore: true */ 'stripe')).default;
      stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-04-10' as any });
    } catch {
      return { url: null, error: 'Stripe package not installed. Run: npm install stripe' };
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, stripeConnectAccountId: true },
    });

    if (!user) return { url: null, error: 'User not found' };

    let accountId = user.stripeConnectAccountId;

    // Create account if not exists
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        email: user.email!,
        capabilities: {
          transfers: { requested: true },
        },
        metadata: { folioUserId: userId },
      });
      accountId = account.id;

      await prisma.user.update({
        where: { id: userId },
        data: { stripeConnectAccountId: accountId },
      });
    }

    // Create onboarding link
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://folioad.com';
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${appUrl}/dashboard/earnings?connect=refresh`,
      return_url: `${appUrl}/dashboard/earnings?connect=complete`,
      type: 'account_onboarding',
    });

    return { url: accountLink.url };
  } catch (error: any) {
    console.error('[Payout] Stripe Connect onboarding error:', error);
    return { url: null, error: error.message };
  }
}

/**
 * Request a payout from Folio credit balance to Stripe Connect account.
 */
export async function requestPayout(params: {
  userId: string;
  amountCents: number;
}): Promise<{ success: boolean; payoutId?: string; error?: string }> {
  const { userId, amountCents } = params;

  if (amountCents < MIN_PAYOUT_CENTS) {
    return { success: false, error: `Minimum payout is $${(MIN_PAYOUT_CENTS / 100).toFixed(2)}` };
  }

  // Check user has Stripe Connect
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { stripeConnectAccountId: true },
  });

  if (!user?.stripeConnectAccountId) {
    return { success: false, error: 'Connect your Stripe account first' };
  }

  // Check available balance
  const account = await prisma.creditAccount.findUnique({
    where: { userId },
    select: { availableBalance: true },
  });

  const availableCents = Math.round(Number(account?.availableBalance || 0) * 100);
  if (amountCents > availableCents) {
    return { success: false, error: 'Insufficient balance' };
  }

  // Calculate fee
  const platformFeeCents = Math.round(amountCents * CASHOUT_FEE_PERCENT / 100);
  const netPayoutCents = amountCents - platformFeeCents;

  // Create payout request
  const payout = await prisma.payoutRequest.create({
    data: {
      userId,
      amountCents,
      platformFeeCents,
      netPayoutCents,
      status: 'PROCESSING',
    },
  });

  // Deduct from credit balance
  const amountDollars = amountCents / 100;
  await prisma.creditAccount.update({
    where: { userId },
    data: {
      availableBalance: { decrement: amountDollars },
      lifetimeRedeemed: { increment: amountDollars },
    },
  });

  // Create Stripe transfer
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('Stripe is not configured');
    }
    const Stripe = (await import(/* webpackIgnore: true */ 'stripe')).default;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-04-10' as any });

    const transfer = await stripe.transfers.create({
      amount: netPayoutCents,
      currency: 'usd',
      destination: user.stripeConnectAccountId,
      metadata: {
        folioUserId: userId,
        payoutRequestId: payout.id,
      },
    });

    // Mark as completed
    await prisma.payoutRequest.update({
      where: { id: payout.id },
      data: {
        status: 'COMPLETED',
        stripeTransferId: transfer.id,
        processedAt: new Date(),
      },
    });

    return { success: true, payoutId: payout.id };
  } catch (stripeError: any) {
    console.error('[Payout] Stripe transfer failed:', stripeError);

    // Refund the balance
    await prisma.creditAccount.update({
      where: { userId },
      data: {
        availableBalance: { increment: amountDollars },
        lifetimeRedeemed: { decrement: amountDollars },
      },
    });

    // Mark payout as failed
    await prisma.payoutRequest.update({
      where: { id: payout.id },
      data: {
        status: 'FAILED',
        failureReason: stripeError.message,
      },
    });

    return { success: false, error: 'Payment transfer failed. Balance restored.' };
  }
}
