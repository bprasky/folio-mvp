export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/orgs/[orgId]/members - List organization members
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

    const { orgId } = params;

    const members = await prisma.organizationUser.findMany({
      where: {
        organizationId: orgId,
        isActive: true,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            profileImage: true,
            role: true,
          }
        }
      },
      orderBy: [
        { role: 'asc' }, // OWNER first, then ADMIN, etc.
        { joinedAt: 'asc' }
      ]
    });

    return NextResponse.json({
      members: members.map(m => ({
        id: m.id,
        userId: m.user.id,
        name: m.user.name,
        email: m.user.email,
        profileImage: m.user.profileImage,
        orgRole: m.role,
        userRole: m.user.role,
        joinedAt: m.joinedAt,
        showOnProfile: m.showOnProfile,
      }))
    });
  } catch (error) {
    console.error('[GET /api/orgs/[orgId]/members] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch members' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/orgs/[orgId]/members - Invite user to organization (admin+)
 * Body: { email, role?: OrgUserRole }
 */
export async function POST(
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
    const membership = await prisma.organizationUser.findFirst({
      where: {
        userId: session.user.id,
        organizationId: orgId,
        role: { in: ['OWNER', 'ADMIN', 'MANAGER'] },
        isActive: true,
      }
    });

    if (!membership) {
      return NextResponse.json(
        { error: 'Only organization admins can invite members' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { email, role = 'MEMBER' } = body;

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Validate role - cannot invite as OWNER
    const validRoles = ['ADMIN', 'MANAGER', 'MEMBER', 'VIEWER'];
    if (!validRoles.includes(role.toUpperCase())) {
      return NextResponse.json(
        { error: `Invalid role. Must be one of: ${validRoles.join(', ')}` },
        { status: 400 }
      );
    }

    // Check if inviter has permission to assign this role
    const roleHierarchy = ['OWNER', 'ADMIN', 'MANAGER', 'MEMBER', 'VIEWER'];
    const inviterRoleIndex = roleHierarchy.indexOf(membership.role);
    const assignedRoleIndex = roleHierarchy.indexOf(role.toUpperCase());

    if (assignedRoleIndex <= inviterRoleIndex) {
      return NextResponse.json(
        { error: 'You cannot assign a role equal to or higher than your own' },
        { status: 403 }
      );
    }

    // Find user by email
    const user = await prisma.user.findFirst({
      where: {
        email: {
          equals: email.toLowerCase().trim(),
          mode: 'insensitive'
        }
      },
      select: { id: true, name: true, email: true }
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found. They must create a Folio account first.' },
        { status: 404 }
      );
    }

    // Check if user is already a member
    const existingMembership = await prisma.organizationUser.findUnique({
      where: {
        userId_organizationId: {
          userId: user.id,
          organizationId: orgId
        }
      }
    });

    if (existingMembership) {
      return NextResponse.json(
        { error: 'User is already a member of this organization' },
        { status: 400 }
      );
    }

    // Add user as member
    const newMembership = await prisma.organizationUser.create({
      data: {
        userId: user.id,
        organizationId: orgId,
        role: role.toUpperCase(),
        isActive: true,
        showOnProfile: true,
      }
    });

    // Clear any pending join requests
    await prisma.orgJoinRequest.deleteMany({
      where: {
        userId: user.id,
        organizationId: orgId,
      }
    });

    return NextResponse.json({
      membership: {
        id: newMembership.id,
        userId: user.id,
        name: user.name,
        email: user.email,
        role: newMembership.role,
      },
      message: `${user.name} has been added to the organization`,
    }, { status: 201 });
  } catch (error: any) {
    console.error('[POST /api/orgs/[orgId]/members] Error:', error);

    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'User is already a member of this organization' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to invite member' },
      { status: 500 }
    );
  }
}
