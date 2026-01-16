/**
 * Subscription API
 *
 * GET /api/subscription - Get current user's subscription details
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import {
  getUserSubscriptionWithUsage,
  getFoundingDesignerInfo,
} from '@/lib/pricing';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    // Get full subscription details with usage
    const subscription = await getUserSubscriptionWithUsage(userId);

    // Get founding designer info
    const foundingDesigner = await getFoundingDesignerInfo(userId);

    // Billing info placeholder (would be integrated with payment provider)
    const billing = null;

    return NextResponse.json({
      subscription,
      foundingDesigner,
      billing,
    });
  } catch (error) {
    console.error('Error fetching subscription:', error);
    return NextResponse.json(
      { error: 'Failed to fetch subscription information' },
      { status: 500 }
    );
  }
}
