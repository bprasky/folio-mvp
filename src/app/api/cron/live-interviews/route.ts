// @idor-allow: public-read reason="Scheduled provider cleanup is protected by CRON_SECRET bearer authorization, not browser sessions."
import { NextResponse } from 'next/server';
import { cleanupLiveSessions } from '@/lib/live-interview/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// One session can require paginated provider reconciliation; each request has a 20s timeout.
export const maxDuration = 800;
const headers = { 'Cache-Control': 'private, no-store' };

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`)
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401, headers });

  try {
    // Trusted cross-user maintenance only ends abandoned provider resources. Keep
    // it available after rollout flags or account access are revoked.
    const { checked } = await cleanupLiveSessions(1);
    return NextResponse.json({ ok: true, checked }, { headers });
  } catch {
    return NextResponse.json({ error: 'Live interview cleanup is temporarily unavailable.' }, { status: 503, headers });
  }
}
