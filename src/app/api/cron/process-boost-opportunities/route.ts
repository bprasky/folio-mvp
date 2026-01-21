import { NextRequest, NextResponse } from 'next/server';
import { processPendingOpportunities } from '@/lib/boost';

/**
 * Cron job to process boost opportunities
 *
 * This endpoint should be called periodically (e.g., every 5 minutes) to:
 * 1. Notify vendors about pending opportunities
 * 2. Expire opportunities past their expiration date
 *
 * Configure with your cron service (Vercel Cron, AWS CloudWatch, etc.)
 * Example Vercel cron config in vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/process-boost-opportunities",
 *     "schedule": "0/5 * * * *"
 *   }]
 * }
 */
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret (for security)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await processPendingOpportunities();

    return NextResponse.json({
      success: true,
      notified: result.notified,
      expired: result.expired,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[cron/process-boost-opportunities] Error:', error);
    return NextResponse.json(
      { error: 'Failed to process boost opportunities' },
      { status: 500 }
    );
  }
}

// Also support POST for flexibility
export async function POST(request: NextRequest) {
  return GET(request);
}
