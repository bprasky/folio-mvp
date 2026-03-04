export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { getUserOrgMemberships, isOrgAdmin } from '@/lib/permissions';

/**
 * GET /api/orgs/[orgId]/team - Get team members
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

    const teamMembers = await prisma.teamMember.findMany({
      where: { organizationId: orgId },
      include: {
        linkedUser: {
          select: {
            id: true,
            name: true,
            email: true,
            profileImage: true
          }
        }
      },
      orderBy: { displayOrder: 'asc' }
    });

    const orgUsers = await prisma.organizationUser.findMany({
      where: { organizationId: orgId, isActive: true },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            profileImage: true
          }
        },
        teamMemberQuiz: true
      }
    });

    return NextResponse.json({
      teamMembers,
      orgUsers
    });
  } catch (error) {
    console.error('[GET /api/orgs/[orgId]/team] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch team members' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/orgs/[orgId]/team - Add a team member
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

    // Verify user is org owner/admin
    const memberships = await getUserOrgMemberships(session.user.id);
    if (!isOrgAdmin(memberships, orgId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { userId, name, role, isManual } = body;

    if (isManual) {
      // Add a manual team member (not linked to a user account)
      const teamMember = await prisma.teamMember.create({
        data: {
          organizationId: orgId,
          name,
          role,
          displayOrder: await getNextDisplayOrder(orgId)
        }
      });

      return NextResponse.json({ success: true, teamMember });
    }

    if (userId) {
      // Add existing user as team member
      const existingMembership = await prisma.organizationUser.findUnique({
        where: {
          userId_organizationId: {
            userId,
            organizationId: orgId
          }
        }
      });

      if (existingMembership) {
        return NextResponse.json(
          { error: 'User is already a team member' },
          { status: 400 }
        );
      }

      // Add user to organization
      const orgUser = await prisma.organizationUser.create({
        data: {
          userId,
          organizationId: orgId,
          role: 'MEMBER'
        }
      });

      // Also create a TeamMember entry for display on profile
      await prisma.teamMember.create({
        data: {
          organizationId: orgId,
          userId,
          name: (await prisma.user.findUnique({ where: { id: userId } }))?.name || '',
          role,
          displayOrder: await getNextDisplayOrder(orgId)
        }
      });

      // Update onboarding progress
      await updateTeamOnboardingProgress(orgId);

      return NextResponse.json({ success: true, orgUser });
    }

    return NextResponse.json(
      { error: 'Invalid request' },
      { status: 400 }
    );
  } catch (error) {
    console.error('[POST /api/orgs/[orgId]/team] Error:', error);
    return NextResponse.json(
      { error: 'Failed to add team member' },
      { status: 500 }
    );
  }
}

async function getNextDisplayOrder(orgId: string): Promise<number> {
  const lastMember = await prisma.teamMember.findFirst({
    where: { organizationId: orgId },
    orderBy: { displayOrder: 'desc' }
  });
  return (lastMember?.displayOrder ?? -1) + 1;
}

async function updateTeamOnboardingProgress(orgId: string): Promise<void> {
  const teamCount = await prisma.teamMember.count({
    where: { organizationId: orgId }
  });

  if (teamCount > 0) {
    await prisma.orgOnboardingProgress.upsert({
      where: { organizationId: orgId },
      create: {
        organizationId: orgId,
        teamSetupComplete: true
      },
      update: {
        teamSetupComplete: true
      }
    });
  }
}
