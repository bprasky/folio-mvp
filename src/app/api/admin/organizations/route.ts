export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/admin/organizations - List all organizations with stats (admin only)
 *
 * Query params:
 * - search: Filter by name
 * - status: UNCLAIMED | CLAIMED | PROFESSIONAL
 * - type: DESIGN_FIRM | VENDOR | MANUFACTURER | SHOWROOM
 * - limit: Number of results
 * - offset: Pagination offset
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    });

    if (user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const status = searchParams.get('status');
    const type = searchParams.get('type');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build where clause
    const where: any = {};

    if (search) {
      where.name = { contains: search, mode: 'insensitive' };
    }

    if (status) {
      where.status = status;
    }

    if (type) {
      where.type = type;
    }

    // Get organizations with counts
    const [organizations, total, stats] = await Promise.all([
      prisma.organization.findMany({
        where,
        include: {
          _count: {
            select: {
              members: true,
              projects: true,
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.organization.count({ where }),
      // Get status breakdown
      prisma.organization.groupBy({
        by: ['status'],
        _count: { status: true }
      })
    ]);

    // Transform stats
    const statusCounts = stats.reduce((acc, s) => {
      acc[s.status.toLowerCase()] = s._count.status;
      return acc;
    }, {} as Record<string, number>);

    // Transform organizations
    const transformedOrgs = organizations.map(org => ({
      id: org.id,
      name: org.name,
      type: org.type,
      status: org.status,
      description: org.description,
      website: org.website,
      logo: org.logo,
      address: org.address,
      phone: org.phone,
      verifiedAt: org.verifiedAt,
      createdAt: org.createdAt,
      memberCount: org._count.members,
      projectCount: org._count.projects,
      salesNotes: org.salesNotes,
      salesContactedAt: org.salesContactedAt,
    }));

    return NextResponse.json({
      organizations: transformedOrgs,
      total,
      stats: statusCounts,
      limit,
      offset,
    });
  } catch (error) {
    console.error('[GET /api/admin/organizations] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch organizations' },
      { status: 500 }
    );
  }
}
