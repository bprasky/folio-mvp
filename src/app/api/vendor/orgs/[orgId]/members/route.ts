export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/vendor/orgs/[orgId]/members?search=name
 * Search vendor org members by name. Used by RepResolverModal.
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
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';

    const members = await prisma.organizationUser.findMany({
      where: {
        organizationId: orgId,
        isActive: true,
        ...(search
          ? { user: { name: { contains: search, mode: 'insensitive' } } }
          : {}),
      },
      select: {
        role: true,
        user: {
          select: {
            id: true,
            name: true,
            profileImage: true,
            title: true,
          },
        },
      },
      take: 20,
      orderBy: {
        user: { name: 'asc' },
      },
    });

    return NextResponse.json({
      members: members.map(m => ({
        userId: m.user.id,
        name: m.user.name,
        role: m.role,
        profileImage: m.user.profileImage,
        title: m.user.title,
      })),
    });
  } catch (error) {
    console.error('[API] /api/vendor/orgs/[orgId]/members error:', error);
    return NextResponse.json({ error: 'Failed to fetch members' }, { status: 500 });
  }
}
