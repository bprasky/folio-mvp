export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/orgs/[orgId]/team/promote-member
 *
 * Body: { userId }
 *
 * Owner-only. Takes an existing OrganizationUser and creates a public
 * TeamMember row for them, pulling display data from their User profile:
 *
 *   - name         ← User.name
 *   - headshotUrl  ← User.profileImage
 *   - bio          ← User.bio
 *   - role         ← User.title (their personal title), or '' if unset
 *
 * Explicitly does NOT pull prior-employment history — only what's already
 * on the individual's Folio bio. If User.bio or User.profileImage is
 * empty, the row still gets created; the org page nudges the member to
 * complete their bio so the team card fills in.
 *
 * Separate from POST /api/orgs/[orgId]/team because that endpoint
 * rejects users who are already OrganizationUsers (it's the "add a new
 * person to the org" flow). This one is the "publish an existing member
 * to the public team display" flow.
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
    const body = await request.json();
    const { userId } = body;

    if (!userId || typeof userId !== 'string') {
      return NextResponse.json({ error: 'userId required' }, { status: 400 });
    }

    const ownerMembership = await prisma.organizationUser.findFirst({
      where: {
        userId: session.user.id,
        organizationId: orgId,
        role: 'OWNER',
        isActive: true,
      },
      select: { id: true },
    });
    if (!ownerMembership) {
      return NextResponse.json(
        { error: 'Only the owner can add members to the team page.' },
        { status: 403 }
      );
    }

    // Target must already be an active OrganizationUser of this org.
    const targetMembership = await prisma.organizationUser.findFirst({
      where: { userId, organizationId: orgId, isActive: true },
      select: { id: true },
    });
    if (!targetMembership) {
      return NextResponse.json(
        { error: 'That user is not a member of this organization.' },
        { status: 404 }
      );
    }

    const existing = await prisma.teamMember.findFirst({
      where: { organizationId: orgId, userId },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json(
        { error: 'They are already on the team page.' },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, profileImage: true, bio: true, title: true },
    });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const lastMember = await prisma.teamMember.findFirst({
      where: { organizationId: orgId },
      orderBy: { displayOrder: 'desc' },
      select: { displayOrder: true },
    });

    const teamMember = await prisma.teamMember.create({
      data: {
        organizationId: orgId,
        userId,
        name: user.name || '',
        headshotUrl: user.profileImage,
        bio: user.bio,
        role: user.title || '',
        displayOrder: (lastMember?.displayOrder ?? -1) + 1,
      },
    });

    return NextResponse.json({ teamMember }, { status: 201 });
  } catch (error: any) {
    console.error('[POST /api/orgs/[orgId]/team/promote-member] Error:', error);
    return NextResponse.json(
      { error: 'Failed to add member to team' },
      { status: 500 }
    );
  }
}
