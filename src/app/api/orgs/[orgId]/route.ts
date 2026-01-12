export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { getUserOrgMemberships, isOrgAdmin, isOrgOwner } from '@/lib/permissions';

/**
 * GET /api/orgs/[orgId] - Get organization details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { orgId: string } }
) {
  try {
    const { orgId } = params;

    const org = await prisma.organization.findUnique({
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
              }
            }
          },
          orderBy: { joinedAt: 'asc' }
        },
        _count: {
          select: {
            designerProjects: true,
            vendorProjects: true,
          }
        }
      }
    });

    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Transform members for response
    const members = org.users.map(m => ({
      id: m.id,
      userId: m.user.id,
      name: m.user.name,
      email: m.user.email,
      profileImage: m.user.profileImage,
      role: m.role,
      joinedAt: m.joinedAt,
    }));

    return NextResponse.json({
      id: org.id,
      name: org.name,
      type: org.type,
      status: org.status,
      description: org.description,
      website: org.website,
      logo: org.logo,
      address: org.address,
      phone: org.phone,
      verifiedAt: org.verifiedAt,
      createdAt: org.createdAt,
      members,
      projectCount: org._count.designerProjects + org._count.vendorProjects,
    });
  } catch (error) {
    console.error('[GET /api/orgs/[orgId]] Error:', error);
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
  { params }: { params: { orgId: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { orgId } = params;

    // Check if user is admin of this org
    const memberships = await getUserOrgMemberships(session.user.id);
    if (!isOrgAdmin(memberships, orgId)) {
      return NextResponse.json(
        { error: 'Only organization admins can update settings' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { name, description, website, logo, address, phone } = body;

    // Build update data (only include provided fields)
    const updateData: any = {};
    if (name !== undefined) updateData.name = name.trim();
    if (description !== undefined) updateData.description = description?.trim() || null;
    if (website !== undefined) updateData.website = website?.trim() || null;
    if (logo !== undefined) updateData.logo = logo?.trim() || null;
    if (address !== undefined) updateData.address = address.trim();
    if (phone !== undefined) updateData.phone = phone.trim();

    const org = await prisma.organization.update({
      where: { id: orgId },
      data: updateData,
      select: {
        id: true,
        name: true,
        type: true,
        status: true,
        description: true,
        website: true,
        logo: true,
        address: true,
        phone: true,
        updatedAt: true,
      }
    });

    return NextResponse.json({
      org,
      message: 'Organization updated successfully',
    });
  } catch (error: any) {
    console.error('[PATCH /api/orgs/[orgId]] Error:', error);

    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

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
  { params }: { params: { orgId: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { orgId } = params;

    // Check if user is owner of this org
    const memberships = await getUserOrgMemberships(session.user.id);
    if (!isOrgOwner(memberships, orgId)) {
      return NextResponse.json(
        { error: 'Only organization owners can delete it' },
        { status: 403 }
      );
    }

    // Check if org is unclaimed
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { status: true }
    });

    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    if (org.status !== 'UNCLAIMED') {
      return NextResponse.json(
        { error: 'Only unclaimed organizations can be deleted' },
        { status: 400 }
      );
    }

    // Delete org (cascades to memberships)
    await prisma.organization.delete({
      where: { id: orgId }
    });

    return NextResponse.json({
      message: 'Organization deleted successfully',
    });
  } catch (error: any) {
    console.error('[DELETE /api/orgs/[orgId]] Error:', error);

    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    return NextResponse.json(
      { error: 'Failed to delete organization' },
      { status: 500 }
    );
  }
}
