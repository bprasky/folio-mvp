export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const VENDOR_ORG_TYPES = ['VENDOR', 'MANUFACTURER', 'SHOWROOM'];

/**
 * GET /api/org/[orgId]/settings/territory
 * Get territory settings for a vendor org
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { orgId } = await params;

    // Verify user is admin/owner of this org
    const membership = await prisma.organizationUser.findFirst({
      where: {
        organizationId: orgId,
        userId: session.user.id,
        isActive: true,
        role: { in: ['OWNER', 'ADMIN'] },
      },
    });

    if (!membership) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: {
        id: true,
        type: true,
        territoryLockEnabled: true,
        dormancyThresholdDays: true,
      },
    });

    if (!org || !VENDOR_ORG_TYPES.includes(org.type)) {
      return NextResponse.json({ error: 'Not a vendor organization' }, { status: 400 });
    }

    return NextResponse.json({
      territoryLockEnabled: org.territoryLockEnabled,
      dormancyThresholdDays: org.dormancyThresholdDays,
    });
  } catch (error) {
    console.error('[org/settings/territory] GET Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * PATCH /api/org/[orgId]/settings/territory
 * Update territory settings (soft lock toggle, dormancy threshold)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { orgId } = await params;
    const body = await request.json();

    // Verify user is admin/owner of this org
    const membership = await prisma.organizationUser.findFirst({
      where: {
        organizationId: orgId,
        userId: session.user.id,
        isActive: true,
        role: { in: ['OWNER', 'ADMIN'] },
      },
    });

    if (!membership) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Validate org is vendor type
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { type: true },
    });

    if (!org || !VENDOR_ORG_TYPES.includes(org.type)) {
      return NextResponse.json({ error: 'Not a vendor organization' }, { status: 400 });
    }

    // Build update data
    const updateData: Record<string, unknown> = {};

    if (typeof body.territoryLockEnabled === 'boolean') {
      updateData.territoryLockEnabled = body.territoryLockEnabled;
    }

    if (typeof body.dormancyThresholdDays === 'number') {
      const days = Math.max(7, Math.min(365, Math.round(body.dormancyThresholdDays)));
      updateData.dormancyThresholdDays = days;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const updated = await prisma.organization.update({
      where: { id: orgId },
      data: updateData,
      select: {
        territoryLockEnabled: true,
        dormancyThresholdDays: true,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('[org/settings/territory] PATCH Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
