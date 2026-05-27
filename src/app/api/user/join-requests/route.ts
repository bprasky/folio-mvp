export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/user/join-requests
 *
 * Lists the current user's PENDING and (recent) REJECTED join requests
 * so the settings hub can show them "your request to join X is waiting
 * for an admin." Mirror of /api/orgs/[orgId]/join's GET, but scoped to
 * the caller instead of an org.
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const requests = await prisma.orgJoinRequest.findMany({
      where: {
        userId: session.user.id,
        status: { in: ['PENDING', 'REJECTED'] },
      },
      select: {
        id: true,
        status: true,
        createdAt: true,
        organization: {
          select: { id: true, name: true, type: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      requests: requests.map((r) => ({
        id: r.id,
        status: r.status,
        createdAt: r.createdAt,
        organizationId: r.organization.id,
        organizationName: r.organization.name,
        organizationType: r.organization.type,
      })),
    });
  } catch (error) {
    console.error('[GET /api/user/join-requests] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch join requests' },
      { status: 500 }
    );
  }
}
