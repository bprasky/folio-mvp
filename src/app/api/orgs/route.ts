// @idor-allow: public-read reason="Public organization directory"
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';


import { prisma } from '@/lib/prisma';

/**
 * GET /api/orgs - Search organizations or get user's organizations
 * Query params:
 *   - userId: get organizations for specific user
 *   - q: search query (name)
 *   - type: filter by org type (VENDOR, DESIGN_FIRM, etc.)
 */
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');
    const query = url.searchParams.get('q');
    const type = url.searchParams.get('type');
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    // If userId is provided, get user's organizations via membership
    if (userId) {
      // Use raw SQL to avoid missing column issues
      const memberships = await prisma.$queryRaw<any[]>`
        SELECT
          ou.id as "membershipId",
          ou."userId",
          ou."organizationId",
          ou.role,
          ou."joinedAt",
          o.id,
          o.name,
          o.type,
          o.website
        FROM organization_users ou
        JOIN organizations o ON ou."organizationId" = o.id
        WHERE ou."userId" = ${userId}
        ORDER BY ou."joinedAt" DESC
        LIMIT ${limit}
      `;

      // Transform to expected format
      const organizations = memberships.map((m: any) => ({
        id: m.id,
        name: m.name,
        type: m.type,
        status: 'UNCLAIMED', // Default since column may not exist
        website: m.website,
        users: [{
          id: m.membershipId,
          userId: m.userId,
          role: m.role,
          showOnProfile: true, // Default since column may not exist
        }]
      }));

      return NextResponse.json({ organizations });
    }

    // Regular search - use minimal columns
    const where: any = {};

    if (query) {
      where.name = {
        contains: query,
        mode: 'insensitive'
      };
    }

    if (type) {
      where.type = type.toUpperCase();
    }

    // Only select columns that exist in prod
    const orgs = await prisma.organization.findMany({
      where,
      select: {
        id: true,
        name: true,
        type: true,
        website: true,
      },
      orderBy: { name: 'asc' },
      take: limit,
      skip: offset,
    });

    // Add defaults for missing columns
    const orgsWithDefaults = orgs.map((org: any) => ({
      ...org,
      status: 'UNCLAIMED',
      _count: { users: 0, designerProjects: 0 },
    }));

    const total = await prisma.organization.count({ where });

    return NextResponse.json({
      orgs: orgsWithDefaults,
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error('[GET /api/orgs] Error:', error);
    return NextResponse.json(
      { error: 'Failed to search organizations' },
      { status: 500 }
    );
  }
}


// Legacy creator uses the same confirmation and duplicate-safe transaction.
export { POST } from '@/app/api/auth/org-setup/route';
