export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { requestPayout, createStripeConnectOnboarding } from '@/lib/commerce/payout';

/**
 * POST /api/commerce/credits/payout
 *
 * Request a cash-out from Folio credit balance to Stripe Connect.
 * Body: { action: 'request' | 'connect', amountCents?: number }
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { action, amountCents } = await request.json();

    if (action === 'connect') {
      // Generate Stripe Connect onboarding link
      const result = await createStripeConnectOnboarding(session.user.id);
      if (!result.url) {
        return NextResponse.json({ error: result.error || 'Failed to create onboarding' }, { status: 500 });
      }
      return NextResponse.json({ url: result.url });
    }

    if (action === 'request') {
      if (!amountCents || amountCents <= 0) {
        return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
      }

      const result = await requestPayout({
        userId: session.user.id,
        amountCents,
      });

      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }

      return NextResponse.json({ success: true, payoutId: result.payoutId });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('[payout] Error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
