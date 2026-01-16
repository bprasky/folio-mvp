export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { calculateBalanceBenefits, getCreditSummary } from '@/lib/commerce/credits';

/**
 * GET /api/commerce/credits/benefits
 * Get the current user's credit balance benefits and tier
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const summary = await getCreditSummary(prisma, session.user.id);
    const benefits = calculateBalanceBenefits(summary.totalBalance);

    return NextResponse.json({
      ok: true,
      balance: summary,
      benefits,
    });
  } catch (error: any) {
    console.error('[commerce/credits/benefits][GET]', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
