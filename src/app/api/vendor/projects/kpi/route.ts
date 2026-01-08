export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

/**
 * Vendor Projects KPI API Endpoint
 * 
 * Returns project-related KPIs for the authenticated vendor.
 * Currently returns placeholder data; wire to real analytics later.
 * 
 * @route GET /api/vendor/projects/kpi
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
      tags: null,
      influenceValueUsd: null,
      saves: null,
      conversionPct: null,
    };

    return NextResponse.json(kpi, {
      headers: {
        'Cache-Control': 'no-store',
      },
    });
  } catch (error: any) {
    console.error('[vendor-projects-kpi][GET]', error);
    return NextResponse.json(
      { error: 'Server error' },
      { status: 500 }
    );
  }
}


