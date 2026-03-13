export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';

/**
 * POST /api/analytics/event
 * Generic analytics event endpoint for client-side tracking.
 * Accepts { type, payload } and logs via logPassiveEvent.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const body = await request.json();
    const { type, payload } = body;

    if (!type) {
      return NextResponse.json({ error: 'Missing type' }, { status: 400 });
    }

    const { logPassiveEvent } = await import('@/lib/analytics');
    await logPassiveEvent({
      type: type as any,
      actorId: session?.user?.id,
      payload,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[analytics/event] Error:', error);
    return NextResponse.json({ ok: true }); // Don't fail the client
  }
}
