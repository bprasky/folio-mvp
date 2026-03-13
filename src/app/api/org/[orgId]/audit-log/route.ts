export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/org/[orgId]/audit-log
 * Org admin audit log of all exchanges (visit records) involving the org
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { orgId } = await params;
    const url = new URL(request.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
    const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit') || '20')));
    const skip = (page - 1) * limit;

    // Verify caller is admin/owner
    const adminMembership = await prisma.organizationUser.findFirst({
      where: {
        organizationId: orgId,
        userId: session.user.id,
        isActive: true,
        role: { in: ['OWNER', 'ADMIN'] },
      },
    });

    if (!adminMembership) {
      return NextResponse.json({ error: 'Only org admins can view audit log' }, { status: 403 });
    }

    // Get all visit records where this org was involved (as initiator or recipient org)
    const where = {
      OR: [
        { initiatorOrgId: orgId },
        { recipientOrgId: orgId },
      ],
    };

    const [visits, total] = await Promise.all([
      prisma.visitRecord.findMany({
        where,
        include: {
          initiatorUser: {
            select: { id: true, name: true, profileImage: true, title: true },
          },
          recipientUser: {
            select: { id: true, name: true, profileImage: true, title: true },
          },
          initiatorOrg: {
            select: { id: true, name: true, type: true, logo: true },
          },
          recipientOrg: {
            select: { id: true, name: true, type: true, logo: true },
          },
          event: {
            select: { id: true, title: true, location: true },
          },
          productShares: {
            select: {
              id: true,
              autoShared: true,
              savedByRecipient: true,
              product: {
                select: { id: true, name: true },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.visitRecord.count({ where }),
    ]);

    return NextResponse.json({
      visits,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('[org/audit-log] GET Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
