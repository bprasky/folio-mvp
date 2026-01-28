export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import {
  trackPresentationView,
  updateScrollDepth,
  updateTimeOnPage,
  trackCTAClick,
} from '@/lib/analytics/vendor-presentation';

/**
 * POST /api/vendor/presentation-analytics
 *
 * Track presentation scroll analytics.
 * Supports multiple action types: view, scroll, time, cta.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'view': {
        const session = await getServerSession(authOptions);
        const { organizationId, presentationType } = body;

        if (!organizationId || !presentationType) {
          return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const viewToken = await trackPresentationView(
          organizationId,
          session?.user?.id ?? null,
          presentationType
        );

        return NextResponse.json({ viewToken });
      }

      case 'scroll': {
        const { viewToken, depth, sectionsViewed } = body;

        if (!viewToken || depth === undefined) {
          return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        await updateScrollDepth(viewToken, depth, sectionsViewed || []);
        return NextResponse.json({ success: true });
      }

      case 'time': {
        const { viewToken: timeToken, timeMs } = body;

        if (!timeToken || !timeMs) {
          return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        await updateTimeOnPage(timeToken, timeMs);
        return NextResponse.json({ success: true });
      }

      case 'cta': {
        const { viewToken: ctaToken, ctaId } = body;

        if (!ctaToken || !ctaId) {
          return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        await trackCTAClick(ctaToken, ctaId);
        return NextResponse.json({ success: true });
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('[vendor/presentation-analytics] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
