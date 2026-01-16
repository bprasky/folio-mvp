export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { releasePendingCredits } from '@/lib/commerce/credits';

/**
 * POST /api/admin/commerce/release-credits
 * Release pending credits that have passed their hold period
 * This should be called by a scheduled job (e.g., daily cron)
 */
export async function POST(request: NextRequest) {
  try {
    // Check for cron secret header (for automated jobs)
    const cronSecret = request.headers.get('x-cron-secret');
    const expectedSecret = process.env.CRON_SECRET;

    let isAuthorized = false;

    // Allow cron jobs with correct secret
    if (cronSecret && expectedSecret && cronSecret === expectedSecret) {
      isAuthorized = true;
    }

    // Or allow admin users
    if (!isAuthorized) {
      const session = await getServerSession(authOptions);
      if (session?.user?.id) {
        const user = await prisma.user.findUnique({
          where: { id: session.user.id },
          select: { role: true },
        });
        if (user?.role === 'ADMIN') {
          isAuthorized = true;
        }
      }
    }

    if (!isAuthorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await releasePendingCredits(prisma);

    console.log(`[release-credits] Processed ${result.processed} transactions, released $${result.totalAmountReleased.toFixed(2)}`);

    return NextResponse.json({
      ok: true,
      processed: result.processed,
      totalAmountReleased: result.totalAmountReleased,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[admin/commerce/release-credits][POST]', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
