export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

/**
 * Vendor Events KPI API Endpoint
 * 
 * Returns event-related KPIs for the authenticated vendor.
 * Currently returns placeholder data; wire to real analytics later.
 * 
 * @route GET /api/vendor/events/kpi
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // TODO: Wire to real analytics queries
    // For now, return placeholder structure
    const kpi = {
      rsvps: null,
      impressions: null,
      interactions: null,
      editorialLiftPct: null,
    };

    return NextResponse.json(kpi, {
      headers: {
        'Cache-Control': 'no-store',
      },
    });
  } catch (error: any) {
    console.error('[vendor-events-kpi][GET]', error);
    return NextResponse.json(
      { error: 'Server error' },
      { status: 500 }
    );
  }
}


