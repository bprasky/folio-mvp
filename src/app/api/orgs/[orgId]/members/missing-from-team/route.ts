export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/orgs/[orgId]/members/missing-from-team
 *
 * Owner-only. Returns active OrganizationUser rows for this org whose
 * userId is NOT yet on the public TeamMember display. Surfaces the
 * "you have new joiners, add them to the team page" prompt on the org
 * profile so the owner doesn't have to remember manually.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { orgId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { orgId } = params;

    const membership = await prisma.organizationUser.findFirst({
      where: {
        userId: session.user.id,
        organizationId: orgId,
        role: 'OWNER',
        isActive: true,
      },
      select: { id: true },
    });
    if (!membership) {
      return NextResponse.json(
        { error: 'Only the owner can see this list.' },
        { status: 403 }
      );
    }

    const [orgUsers, teamMembers] = await Promise.all([
      prisma.organizationUser.findMany({
        where: { organizationId: orgId, isActive: true },
        select: {
          userId: true,
          role: true,
          joinedAt: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              profileImage: true,
              title: true,
              bio: true,
            },
          },
        },
        orderBy: { joinedAt: 'desc' },
      }),
      prisma.teamMember.findMany({
        where: { organizationId: orgId, userId: { not: null } },
        select: { userId: true },
      }),
    ]);

    const onTeam = new Set(teamMembers.map((t) => t.userId).filter(Boolean));
    const missing = orgUsers
      .filter((ou) => !onTeam.has(ou.userId))
      .map((ou) => ({
        userId: ou.userId,
        orgRole: ou.role,
        joinedAt: ou.joinedAt,
        name: ou.user.name,
        email: ou.user.email,
        profileImage: ou.user.profileImage,
        title: ou.user.title,
        hasBio: !!(ou.user.bio && ou.user.bio.trim().length > 0),
      }));

    return NextResponse.json({ missing });
  } catch (error) {
    console.error('[GET /api/orgs/[orgId]/members/missing-from-team] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch missing team members' },
      { status: 500 }
    );
  }
}
