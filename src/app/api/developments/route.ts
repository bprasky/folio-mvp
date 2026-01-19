export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import { DevelopmentStatus, OrgType } from "@prisma/client";

/**
 * POST /api/developments
 *
 * Creates a new development listing.
 * Requires user to be a member of a DEVELOPER organization.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as { id: string; role: string };
    const body = await req.json();

    const {
      developerOrgId,
      name,
      slug,
      description,
      address,
      city,
      state,
      country = "USA",
      totalUnits,
      status = DevelopmentStatus.PLANNING,
      expectedCompletion,
      heroImageUrl,
      galleryUrls = [],
    } = body;

    // Validate required fields
    if (!developerOrgId || !name || !slug || !address || !city || !state || !totalUnits) {
      return NextResponse.json(
        { error: "Missing required fields: developerOrgId, name, slug, address, city, state, totalUnits" },
        { status: 400 }
      );
    }

    // Verify user has access to this organization
    const orgAccess = await prisma.organizationUser.findFirst({
      where: {
        userId: user.id,
        organizationId: developerOrgId,
        isActive: true,
      },
      include: {
        organization: true,
      },
    });

    const isAdmin = user.role === 'ADMIN';

    if (!isAdmin && !orgAccess) {
      return NextResponse.json(
        { error: "Forbidden - not a member of this organization" },
        { status: 403 }
      );
    }

    // Verify organization is a DEVELOPER type
    if (!isAdmin && orgAccess?.organization.type !== OrgType.DEVELOPER) {
      return NextResponse.json(
        { error: "Organization must be a DEVELOPER type to create developments" },
        { status: 400 }
      );
    }

    // Check slug uniqueness
    const existingSlug = await prisma.development.findUnique({
      where: { slug },
    });

    if (existingSlug) {
      return NextResponse.json(
        { error: "Slug already exists" },
        { status: 409 }
      );
    }

    // Create development
    const development = await prisma.development.create({
      data: {
        developerOrgId,
        name,
        slug,
        description,
        address,
        city,
        state,
        country,
        totalUnits,
        status,
        expectedCompletion: expectedCompletion ? new Date(expectedCompletion) : null,
        heroImageUrl,
        galleryUrls,
      },
      include: {
        developerOrg: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            unitTypes: true,
            finishPackages: true,
            productCatalog: true,
            designerPool: true,
          },
        },
      },
    });

    return NextResponse.json({ development }, { status: 201 });

  } catch (error: any) {
    console.error("Error creating development:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to create development" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/developments
 *
 * Lists developments. Supports filtering by:
 * - developerOrgId: Filter by organization
 * - status: Filter by development status
 * - city/state: Filter by location
 * - published: Show only published (publishedAt != null)
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user as { id: string; role: string } | undefined;

    const searchParams = req.nextUrl.searchParams;
    const developerOrgId = searchParams.get('developerOrgId');
    const status = searchParams.get('status') as DevelopmentStatus | null;
    const city = searchParams.get('city');
    const state = searchParams.get('state');
    const published = searchParams.get('published') === 'true';
    const consultationsEnabled = searchParams.get('consultationsEnabled') === 'true';
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build where clause
    const where: any = {};

    if (developerOrgId) {
      where.developerOrgId = developerOrgId;
    }

    if (status) {
      where.status = status;
    }

    if (city) {
      where.city = { contains: city, mode: 'insensitive' };
    }

    if (state) {
      where.state = state;
    }

    if (published) {
      where.publishedAt = { not: null };
    }

    if (consultationsEnabled) {
      where.consultationsEnabled = true;
    }

    // For non-authenticated users or non-org members, only show published developments
    if (!user) {
      where.publishedAt = { not: null };
    } else if (user.role !== 'ADMIN' && !developerOrgId) {
      // If not filtering by org, show published OR user's org developments
      const userOrgs = await prisma.organizationUser.findMany({
        where: { userId: user.id, isActive: true },
        select: { organizationId: true },
      });
      const orgIds = userOrgs.map(o => o.organizationId);

      where.OR = [
        { publishedAt: { not: null } },
        { developerOrgId: { in: orgIds } },
      ];
    }

    const [developments, total] = await Promise.all([
      prisma.development.findMany({
        where,
        include: {
          developerOrg: {
            select: {
              id: true,
              name: true,
              logo: true,
            },
          },
          _count: {
            select: {
              unitTypes: true,
              finishPackages: true,
              designerPool: true,
              consultations: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.development.count({ where }),
    ]);

    return NextResponse.json({
      developments,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + developments.length < total,
      },
    });

  } catch (error: any) {
    console.error("Error listing developments:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to list developments" },
      { status: 500 }
    );
  }
}
