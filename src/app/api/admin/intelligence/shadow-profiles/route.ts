export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { recalculateVendorShadowProfiles } from '@/lib/intelligence/shadow-profiles';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/admin/intelligence/shadow-profiles
 * Trigger shadow profile recalculation. Admin only.
 */
export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const role = (session.user as Record<string, unknown>).role;
    if (role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const updated = await recalculateVendorShadowProfiles();

    return NextResponse.json({
      success: true,
      vendorProfilesUpdated: updated,
    });
  } catch (error) {
    console.error('[API] shadow-profiles recalc error:', error);
    return NextResponse.json({ error: 'Failed to recalculate' }, { status: 500 });
  }
}

/**
 * GET /api/admin/intelligence/shadow-profiles
 * List all vendor shadow profiles. Admin only.
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const role = (session.user as Record<string, unknown>).role;
    if (role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const profiles = await prisma.vendorShadowProfile.findMany({
      include: {
        reps: true,
        vendorOrg: { select: { id: true, name: true, status: true } },
      },
      orderBy: { totalDesigners: 'desc' },
      take: 100,
    });

    // Convert Decimals
    const serialized = profiles.map(p => ({
      ...p,
      totalQuotedValue: p.totalQuotedValue ? Number(p.totalQuotedValue) : null,
      avgOrderValue: p.avgOrderValue ? Number(p.avgOrderValue) : null,
    }));

    return NextResponse.json({ profiles: serialized });
  } catch (error) {
    console.error('[API] shadow-profiles list error:', error);
    return NextResponse.json({ error: 'Failed to fetch profiles' }, { status: 500 });
  }
}
