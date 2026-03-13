export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const VENDOR_ORG_TYPES = ['VENDOR', 'MANUFACTURER', 'SHOWROOM'];

/**
 * GET /api/org/[orgId]/territory/assign
 * List all territory assignments for a vendor org
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

    // Verify membership
    const membership = await prisma.organizationUser.findFirst({
      where: {
        organizationId: orgId,
        userId: session.user.id,
        isActive: true,
      },
    });

    if (!membership) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const assignments = await prisma.orgTerritoryAssignment.findMany({
      where: { vendorOrgId: orgId },
      include: {
        repUser: { select: { id: true, name: true, profileImage: true, title: true } },
        designerOrg: { select: { id: true, name: true, type: true, logo: true } },
      },
      orderBy: { assignedAt: 'desc' },
    });

    return NextResponse.json({ assignments });
  } catch (error) {
    console.error('[territory/assign] GET Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * POST /api/org/[orgId]/territory/assign
 * Admin assigns a rep to a designer org account
 */
export async function POST(
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
    const { repUserId, designerOrgId, expiresAt } = body;

    if (!repUserId || !designerOrgId) {
      return NextResponse.json({ error: 'repUserId and designerOrgId are required' }, { status: 400 });
    }

    // Verify caller is admin/owner
    const adminMembership = await prisma.organizationUser.findFirst({
      where: {
        organizationId: orgId,
        userId: session.user.id,
        isActive: true,
        role: { in: ['OWNER', 'ADMIN'] },
      },
    });

    if (!adminMembership) {
      return NextResponse.json({ error: 'Only org admins can assign territories' }, { status: 403 });
    }

    // Verify org is vendor type
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { type: true },
    });

    if (!org || !VENDOR_ORG_TYPES.includes(org.type)) {
      return NextResponse.json({ error: 'Not a vendor organization' }, { status: 400 });
    }

    // Verify rep is a member of this org
    const repMembership = await prisma.organizationUser.findFirst({
      where: {
        organizationId: orgId,
        userId: repUserId,
        isActive: true,
      },
    });

    if (!repMembership) {
      return NextResponse.json({ error: 'Rep is not a member of this organization' }, { status: 400 });
    }

    // Verify designer org exists
    const designerOrg = await prisma.organization.findUnique({
      where: { id: designerOrgId },
      select: { id: true, name: true },
    });

    if (!designerOrg) {
      return NextResponse.json({ error: 'Designer organization not found' }, { status: 404 });
    }

    // Upsert: one primary rep per designer org
    const assignment = await prisma.orgTerritoryAssignment.upsert({
      where: {
        vendorOrgId_designerOrgId: {
          vendorOrgId: orgId,
          designerOrgId,
        },
      },
      update: {
        repUserId,
        assignedBy: session.user.id,
        assignedAt: new Date(),
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
      create: {
        vendorOrgId: orgId,
        repUserId,
        designerOrgId,
        assignedBy: session.user.id,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
      include: {
        repUser: { select: { id: true, name: true, profileImage: true } },
        designerOrg: { select: { id: true, name: true, type: true } },
      },
    });

    return NextResponse.json({ assignment });
  } catch (error) {
    console.error('[territory/assign] POST Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
