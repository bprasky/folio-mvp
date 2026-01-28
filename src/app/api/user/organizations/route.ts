export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/user/organizations
 * Fetch organizations the current user belongs to
 *
 * Query params:
 * - type: 'VENDOR' | 'DESIGNER_STUDIO' | 'all' (default 'all')
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const typeFilter = searchParams.get('type');

    const whereClause: any = {
      userId: session.user.id,
      isActive: true,
    };

    if (typeFilter && typeFilter !== 'all') {
      whereClause.organization = {
        type: typeFilter,
      };
    }

    const memberships = await prisma.organizationUser.findMany({
      where: whereClause,
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            type: true,
            logoUrl: true,
          },
        },
      },
      orderBy: {
        organization: {
          name: 'asc',
        },
      },
    });

    const organizations = memberships.map((m) => ({
      id: m.organization.id,
      name: m.organization.name,
      type: m.organization.type,
      logoUrl: m.organization.logoUrl,
      role: m.role,
    }));

    return NextResponse.json({ organizations });
  } catch (error) {
    console.error('[user/organizations] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch organizations' },
      { status: 500 }
    );
  }
}
