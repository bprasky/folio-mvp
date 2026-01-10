import { NextRequest, NextResponse } from 'next/server';
import { processPendingCredits } from '@/lib/commerce/credit';

export const dynamic = 'force-dynamic';

/**
 * Cron job endpoint for processing pending credits.
 *
 * This endpoint should be called periodically (e.g., daily) to move
 * matured pending credits to available balance.
 *
 * Authentication is done via CRON_SECRET environment variable.
 *
 * Example cron setup (Vercel):
 * vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/process-credits",
 *     "schedule": "0 0 * * *"
 *   }]
 * }
 */
export async function POST(req: NextRequest) {
  // Verify cron secret
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error('CRON_SECRET environment variable not set');
    return NextResponse.json(
      { error: 'Server configuration error' },
      { status: 500 }
    );
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await processPendingCredits();
    console.log('Credit processing completed:', result);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Credit processing error:', error);
    return NextResponse.json(
      { error: 'Processing failed' },
      { status: 500 }
    );
  }
}

// Also support GET for Vercel cron (sends GET requests)
export async function GET(req: NextRequest) {
  // Verify cron secret via header or query param
  const authHeader = req.headers.get('authorization');
  const { searchParams } = new URL(req.url);
  const secretParam = searchParams.get('secret');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error('CRON_SECRET environment variable not set');
    return NextResponse.json(
      { error: 'Server configuration error' },
      { status: 500 }
    );
  }

  const isAuthorized =
    authHeader === `Bearer ${cronSecret}` || secretParam === cronSecret;

  if (!isAuthorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await processPendingCredits();
    console.log('Credit processing completed:', result);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Credit processing error:', error);
    return NextResponse.json(
      { error: 'Processing failed' },
      { status: 500 }
    );
  }
}
