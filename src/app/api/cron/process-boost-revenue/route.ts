// @idor-allow: public-read reason="Vercel cron endpoint protected by CRON_SECRET bearer header, not session auth"
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { processAllBoostRevenue } from '@/lib/boost/calculateBoostRevenue';

/**
 * POST /api/cron/process-boost-revenue
 *
 * Daily cron job that processes all unbilled boost revenue.
 * Converts impressions/clicks → designer credits (70%) + Folio revenue (30%).
 *
 * Can be triggered by:
 * - Vercel Cron (add to vercel.json)
 * - External cron service
 * - Manual admin trigger
 *
 * Protected by CRON_SECRET header to prevent unauthorized access.
 */
export async function POST(request: NextRequest) {
  // Verify cron secret (skip in development)
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && process.env.NODE_ENV === 'production') {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    const result = await processAllBoostRevenue();

    console.log('[Cron] Boost revenue processed:', {
      processed: result.processed,
      totalGross: `$${(result.totalGrossCents / 100).toFixed(2)}`,
      designerPayout: `$${(result.totalDesignerCents / 100).toFixed(2)}`,
      folioRevenue: `$${(result.totalFolioCents / 100).toFixed(2)}`,
    });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('[Cron] Failed to process boost revenue:', error);
    return NextResponse.json(
      { error: 'Failed to process boost revenue' },
      { status: 500 }
    );
  }
}
