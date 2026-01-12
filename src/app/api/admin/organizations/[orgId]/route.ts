export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/admin/organizations/[orgId] - Get organization details (admin only)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { orgId: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    });

    if (user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { orgId } = params;

    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                profileImage: true,
              }
            }
          }
        },
        _count: {
          select: {
            projects: true,
            joinRequests: true,
          }
        }
      }
    });

    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    return NextResponse.json(org);
  } catch (error) {
    console.error('[GET /api/admin/organizations/[orgId]] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch organization' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/organizations/[orgId] - Update organization (admin only)
 *
 * Body: { status?, salesNotes?, salesContactedAt?, verifiedAt?, verifiedBy?, ... }
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

    // Check if user is admin
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    });

    if (user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { orgId } = params;
    const body = await request.json();

    // Allowed fields for admin update
    const allowedFields = [
      'name',
      'description',
      'website',
      'logo',
      'address',
      'phone',
      'status',
      'salesNotes',
      'salesContactedAt',
      'verifiedAt',
      'verifiedBy',
      'businessLicense',
    ];

    const updateData: any = {};

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        if (field === 'verifiedAt' || field === 'salesContactedAt') {
          updateData[field] = body[field] ? new Date(body[field]) : null;
        } else {
          updateData[field] = body[field];
        }
      }
    }

    // If status is being changed to CLAIMED or PROFESSIONAL, set verification
    if (body.status === 'CLAIMED' || body.status === 'PROFESSIONAL') {
      if (!updateData.verifiedAt) {
        updateData.verifiedAt = new Date();
      }
      if (!updateData.verifiedBy) {
        updateData.verifiedBy = session.user.id;
      }
    }

    const updated = await prisma.organization.update({
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
        verifiedAt: true,
        verifiedBy: true,
        salesNotes: true,
        salesContactedAt: true,
        createdAt: true,
        updatedAt: true,
      }
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('[PATCH /api/admin/organizations/[orgId]] Error:', error);
    return NextResponse.json(
      { error: 'Failed to update organization' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/organizations/[orgId] - Delete organization (admin only)
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

    // Check if user is admin
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    });

    if (user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { orgId } = params;

    // Check org exists
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { id: true, status: true }
    });

    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Delete in transaction
    await prisma.$transaction([
      // Delete join requests
      prisma.orgJoinRequest.deleteMany({ where: { organizationId: orgId } }),
      // Delete memberships
      prisma.organizationUser.deleteMany({ where: { organizationId: orgId } }),
      // Delete the org
      prisma.organization.delete({ where: { id: orgId } }),
    ]);

    return NextResponse.json({ message: 'Organization deleted' });
  } catch (error) {
    console.error('[DELETE /api/admin/organizations/[orgId]] Error:', error);
    return NextResponse.json(
      { error: 'Failed to delete organization' },
      { status: 500 }
    );
  }
}
