import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { AdminRole, ADMIN_ROLES, canManageAdminRoles } from '@/lib/adminRoles';

/**
 * GET /api/admin/users/[id]/admin-role
 * Get a user's current admin role
 * Requires: SUPER_ADMIN
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify caller is SUPER_ADMIN
    const callerAdminRole = (session.user as any).adminRole;
    if (!canManageAdminRoles(callerAdminRole)) {
      return NextResponse.json(
        { error: 'Forbidden: Only SUPER_ADMIN can manage admin roles' },
        { status: 403 }
      );
    }

    const { id } = await params;

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        adminRole: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      adminRole: user.adminRole,
    });
  } catch (error) {
    console.error('Error fetching user admin role:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user admin role' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/users/[id]/admin-role
 * Update a user's admin role
 * Requires: SUPER_ADMIN
 *
 * Body: { adminRole: 'SUPER_ADMIN' | 'ADMIN' | 'SUPPORT' | 'CURATOR' | null }
 * Pass null to remove admin role
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify caller is SUPER_ADMIN
    const callerAdminRole = (session.user as any).adminRole;
    if (!canManageAdminRoles(callerAdminRole)) {
      return NextResponse.json(
        { error: 'Forbidden: Only SUPER_ADMIN can manage admin roles' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const { adminRole } = body;

    // Validate adminRole value
    if (adminRole !== null && !ADMIN_ROLES.includes(adminRole)) {
      return NextResponse.json(
        { error: `Invalid admin role. Must be one of: ${ADMIN_ROLES.join(', ')} or null` },
        { status: 400 }
      );
    }

    // Prevent self-demotion for SUPER_ADMIN (to avoid lockout)
    if (id === session.user.id && adminRole !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { error: 'Cannot demote yourself from SUPER_ADMIN. Ask another SUPER_ADMIN.' },
        { status: 400 }
      );
    }

    // Find the target user
    const targetUser = await prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, name: true, role: true, adminRole: true },
    });

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Update the user's admin role
    // If assigning an admin role, also ensure their role is ADMIN
    const updateData: { adminRole: AdminRole | null; role?: 'ADMIN' } = {
      adminRole: adminRole as AdminRole | null,
    };

    // If giving an admin role, also set their role to ADMIN (for backward compatibility)
    if (adminRole !== null) {
      updateData.role = 'ADMIN';
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        adminRole: true,
      },
    });

    console.log(
      `[ADMIN_ROLE_CHANGE] ${session.user.email} changed ${targetUser.email} from ${targetUser.adminRole || 'none'} to ${adminRole || 'none'}`
    );

    return NextResponse.json({
      message: `Admin role updated successfully`,
      user: {
        userId: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        role: updatedUser.role,
        adminRole: updatedUser.adminRole,
      },
    });
  } catch (error) {
    console.error('Error updating user admin role:', error);
    return NextResponse.json(
      { error: 'Failed to update user admin role' },
      { status: 500 }
    );
  }
}
