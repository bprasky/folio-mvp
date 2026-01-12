export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import {
  getUserOrgMemberships,
  isOrgAdmin,
  isOrgOwner,
  canDeleteOrg,
} from '@/lib/permissions';

/**
 * GET /api/orgs/[orgId] - Get organization details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { orgId } = await params;

    const organization = await prisma.organization.findUnique({
      where: { id: orgId },
      include: {
        users: {
          where: { isActive: true },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                profileImage: true,
                title: true,
              },
            },
          },
          orderBy: [
            { role: 'asc' }, // OWNER first
            { joinedAt: 'asc' },
          ],
        },
        _count: {
          select: {
            users: { where: { isActive: true } },
            vendorProjects: true,
            designerProjects: true,
          },
        },
      },
    });

    if (!organization) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(organization);
  } catch (error) {
    console.error('Error fetching organization:', error);
    return NextResponse.json(
      { error: 'Failed to fetch organization' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/orgs/[orgId] - Update organization (owner/admin only)
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
    const memberships = await getUserOrgMemberships(session.user.id);

    if (!isOrgAdmin(memberships, orgId)) {
      return NextResponse.json(
        { error: 'Only org owners and admins can update organization settings' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      name,
      description,
      website,
      logo,
      address,
      phone,
      salesNotes,
    } = body;

    // Only update provided fields
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (website !== undefined) updateData.website = website;
    if (logo !== undefined) updateData.logo = logo;
    if (address !== undefined) updateData.address = address;
    if (phone !== undefined) updateData.phone = phone;
    if (salesNotes !== undefined) updateData.salesNotes = salesNotes;

    const organization = await prisma.organization.update({
      where: { id: orgId },
      data: updateData,
      include: {
        users: {
          where: { isActive: true },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                profileImage: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json(organization);
  } catch (error) {
    console.error('Error updating organization:', error);
    return NextResponse.json(
      { error: 'Failed to update organization' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/orgs/[orgId] - Delete organization (owner only, unclaimed only)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { orgId } = await params;
    const memberships = await getUserOrgMemberships(session.user.id);

    if (!canDeleteOrg(memberships, orgId)) {
      return NextResponse.json(
        { error: 'Only org owners can delete unclaimed organizations' },
        { status: 403 }
      );
    }

    await prisma.organization.delete({
      where: { id: orgId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting organization:', error);
    return NextResponse.json(
      { error: 'Failed to delete organization' },
      { status: 500 }
    );
  }
}
