export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';

/**
 * PATCH /api/orgs/[orgId]/team/[orgUserId]/quiz/settings - Update quiz privacy settings
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { orgId: string; orgUserId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { orgId, orgUserId } = params;

    // Verify the orgUser exists and belongs to this user
    const orgUser = await prisma.organizationUser.findUnique({
      where: { id: orgUserId }
    });

    if (!orgUser || orgUser.organizationId !== orgId || orgUser.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { showOnPersonalProfile, showRoleOnProfile } = await request.json();

    // Update settings
    const quiz = await prisma.teamMemberQuiz.update({
      where: { orgUserId },
      data: {
        showOnPersonalProfile: showOnPersonalProfile ?? undefined,
        showRoleOnProfile: showRoleOnProfile ?? undefined
      }
    });

    return NextResponse.json({ success: true, quiz });
  } catch (error) {
    console.error('[PATCH /api/orgs/[orgId]/team/[orgUserId]/quiz/settings] Error:', error);
    return NextResponse.json(
      { error: 'Failed to update settings' },
      { status: 500 }
    );
  }
}
