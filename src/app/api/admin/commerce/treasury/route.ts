export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  getTreasuryMetrics,
  getMonthlyTreasuryReports,
  getVendorPerformance,
  getDesignerEarningsReport,
  estimateFloatYield,
} from '@/lib/commerce/treasury';

/**
 * GET /api/admin/commerce/treasury
 * Get treasury dashboard metrics (admin only)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify admin role
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    if (user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const view = searchParams.get('view') || 'overview'; // overview, monthly, vendors, designers

    if (view === 'overview') {
      const metrics = await getTreasuryMetrics(prisma);
      const floatYield = estimateFloatYield(
        metrics.estimatedFloatValue,
        4.5,
        metrics.averageHoldDays
      );

      return NextResponse.json({
        ok: true,
        metrics,
        floatYield,
      });
    }

    if (view === 'monthly') {
      const months = parseInt(searchParams.get('months') || '12', 10);
      const endDate = new Date();
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - months);

      const reports = await getMonthlyTreasuryReports(prisma, startDate, endDate);

      return NextResponse.json({
        ok: true,
        reports,
        dateRange: { startDate, endDate },
      });
    }

    if (view === 'vendors') {
      const limit = parseInt(searchParams.get('limit') || '20', 10);
      const performance = await getVendorPerformance(prisma, { limit });

      return NextResponse.json({
        ok: true,
        vendors: performance,
      });
    }

    if (view === 'designers') {
      const limit = parseInt(searchParams.get('limit') || '50', 10);
      const sortBy = searchParams.get('sortBy') as 'earned' | 'pending' | 'orders' || 'earned';
      const designers = await getDesignerEarningsReport(prisma, { limit, sortBy });

      return NextResponse.json({
        ok: true,
        designers,
      });
    }

    return NextResponse.json({ error: 'Invalid view parameter' }, { status: 400 });
  } catch (error: any) {
    console.error('[admin/commerce/treasury][GET]', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
