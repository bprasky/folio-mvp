// @idor-allow: public-read reason="Public organization directory"
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
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

/**
 * POST /api/orgs - Create a new organization
 * Body: { name, type, website? }
 *
 * Creates org with minimal data, adds creator as member
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, type, website, workEmail } = body;

    // Validate required fields
    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: 'Organization name is required' },
        { status: 400 }
      );
    }

    if (!workEmail || !workEmail.trim()) {
      return NextResponse.json(
        { error: 'Work email is required' },
        { status: 400 }
      );
    }

    // Validate org type - includes new ARCHITECTURE_FIRM
    const validTypes = ['VENDOR', 'DESIGN_FIRM', 'MANUFACTURER', 'SHOWROOM', 'CONTRACTOR', 'ARCHITECTURE_FIRM'];
    const orgType = type?.toUpperCase() || 'DESIGN_FIRM';
    if (!validTypes.includes(orgType)) {
      return NextResponse.json(
        { error: `Invalid type. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // Use raw SQL to avoid Prisma trying to set default values for missing columns
    const orgId = crypto.randomUUID();
    const orgUserId = crypto.randomUUID();
    const trimmedName = name.trim();
    const trimmedWebsite = website?.trim() || null;
    const trimmedWorkEmail = workEmail.trim();

    await prisma.$executeRaw`
      INSERT INTO organizations (id, name, type, website, "createdAt", "updatedAt")
      VALUES (${orgId}, ${trimmedName}, ${orgType}::"OrgType", ${trimmedWebsite}, NOW(), NOW())
    `;

    // Add creator as member with work email
    // Note: workEmail column may not exist in prod yet - try with it, fall back without
    try {
      await prisma.$executeRaw`
        INSERT INTO organization_users (id, "userId", "organizationId", role, "joinedAt", "workEmail")
        VALUES (${orgUserId}, ${session.user.id}, ${orgId}, 'OWNER'::"OrgUserRole", NOW(), ${trimmedWorkEmail})
      `;
    } catch (emailError: any) {
      // workEmail column doesn't exist yet, insert without it
      console.log('[POST /api/orgs] workEmail column not available, inserting without:', trimmedWorkEmail);
      await prisma.$executeRaw`
        INSERT INTO organization_users (id, "userId", "organizationId", role, "joinedAt")
        VALUES (${orgUserId}, ${session.user.id}, ${orgId}, 'OWNER'::"OrgUserRole", NOW())
      `;
    }

    // Update user's role based on org type using Prisma ORM
    // (role column exists in prod, only need raw SQL for tables with missing columns)
    // Map org type to user role:
    // - DESIGN_FIRM -> DESIGNER
    // - ARCHITECTURE_FIRM -> ARCHITECT
    // - CONTRACTOR -> BUILDER
    // - All others (VENDOR, MANUFACTURER, SHOWROOM) -> VENDOR
    let userRole = 'VENDOR';
    if (orgType === 'DESIGN_FIRM') userRole = 'DESIGNER';
    else if (orgType === 'ARCHITECTURE_FIRM') userRole = 'ARCHITECT';
    else if (orgType === 'CONTRACTOR') userRole = 'BUILDER';

    await prisma.user.update({
      where: { id: session.user.id },
      data: { role: userRole as any },
    });

    return NextResponse.json({
      org: { id: orgId, name: trimmedName, type: orgType },
      message: 'Organization created successfully',
    }, { status: 201 });
  } catch (error: any) {
    console.error('[POST /api/orgs] Error:', error);

    if (error.code === 'P2002' || error.message?.includes('unique')) {
      return NextResponse.json(
        { error: 'An organization with this name already exists' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create organization', debug: error?.message },
      { status: 500 }
    );
  }
}
