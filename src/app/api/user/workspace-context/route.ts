import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/user/workspace-context
 * Toggle the user's workspace context between individual and organization
 *
 * Request body:
 * { operatingAsOrgId: string | null }
 *
 * - null: Operating as individual
 * - orgId: Operating as that organization
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { operatingAsOrgId } = body;

    // Validate the operatingAsOrgId
    if (operatingAsOrgId !== null && typeof operatingAsOrgId !== 'string') {
      return NextResponse.json(
        { error: 'Invalid operatingAsOrgId - must be string or null' },
        { status: 400 }
      );
    }

    // If setting to an org, validate user belongs to that org
    if (operatingAsOrgId) {
      const membership = await prisma.organizationUser.findFirst({
        where: {
          userId: session.user.id,
          organizationId: operatingAsOrgId,
          isActive: true,
        },
      });

      if (!membership) {
        return NextResponse.json(
          { error: 'You do not belong to this organization' },
          { status: 403 }
        );
      }
    }

    // Update the user's workspace context
    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      data: { operatingAsOrgId },
      select: {
        id: true,
        name: true,
        email: true,
        operatingAsOrgId: true,
        operatingAsOrg: {
          select: {
            id: true,
            name: true,
            logo: true,
            type: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      user: updatedUser,
    });
  } catch (error) {
    console.error('Error updating workspace context:', error);
    return NextResponse.json(
      { error: 'Failed to update workspace context' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/user/workspace-context
 * Get the user's current workspace context
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        profileImage: true,
        operatingAsOrgId: true,
        operatingAsOrg: {
          select: {
            id: true,
            name: true,
            logo: true,
            type: true,
          },
        },
        organizationUsers: {
          where: { isActive: true },
          select: {
            role: true,
            organization: {
              select: {
                id: true,
                name: true,
                logo: true,
                type: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      operatingAsOrgId: user.operatingAsOrgId,
      operatingAsOrg: user.operatingAsOrg,
      organizations: user.organizationUsers.map(ou => ({
        ...ou.organization,
        userRole: ou.role,
      })),
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        profileImage: user.profileImage,
      },
    });
  } catch (error) {
    console.error('Error fetching workspace context:', error);
    return NextResponse.json(
      { error: 'Failed to fetch workspace context' },
      { status: 500 }
    );
  }
}
