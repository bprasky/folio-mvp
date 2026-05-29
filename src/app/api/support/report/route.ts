export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';

/**
 * POST /api/support/report
 * Thin endpoint for "Report this issue" surfaces (e.g. a failed website import).
 * Logs for triage; userId is attached server-side and never trusted from the body.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string })?.id ?? null;

    const { url, errorType, errorMessage } = await req.json().catch(() => ({}));

    console.warn('[support/report]', {
      userId,
      url: typeof url === 'string' ? url.slice(0, 500) : null,
      errorType: typeof errorType === 'string' ? errorType.slice(0, 100) : null,
      errorMessage: typeof errorMessage === 'string' ? errorMessage.slice(0, 1000) : null,
      at: new Date().toISOString(),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[support/report] error:', error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
