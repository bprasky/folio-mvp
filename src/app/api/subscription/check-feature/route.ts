/**
 * Feature Access Check API
 *
 * GET /api/subscription/check-feature?feature=<featureKey> - Check if user can access a feature
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { checkFeatureAccess } from '@/lib/pricing';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const featureKey = request.nextUrl.searchParams.get('feature');

    if (!featureKey) {
      return NextResponse.json(
        { error: 'Missing feature parameter' },
        { status: 400 }
      );
    }

    const result = await checkFeatureAccess(session.user.id, featureKey);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error checking feature access:', error);
    return NextResponse.json(
      { error: 'Failed to check feature access' },
      { status: 500 }
    );
  }
}
