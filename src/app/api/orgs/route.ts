export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/orgs - Search organizations
 * Query params:
 *   - q: search query (name)
 *   - type: filter by org type (VENDOR, DESIGN_FIRM, etc.)
 *   - status: filter by status (UNCLAIMED, CLAIMED, PROFESSIONAL)
 */
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const query = url.searchParams.get('q');
    const type = url.searchParams.get('type');
    const status = url.searchParams.get('status');
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const offset = parseInt(url.searchParams.get('offset') || '0');

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

    if (status) {
      where.status = status.toUpperCase();
    }

    const [orgs, total] = await Promise.all([
      prisma.organization.findMany({
        where,
        select: {
          id: true,
          name: true,
          type: true,
          status: true,
          description: true,
          website: true,
          logo: true,
          address: true,
          phone: true,
          createdAt: true,
          _count: {
            select: {
              users: true,
              designerProjects: true,
            }
          }
        },
        orderBy: { name: 'asc' },
        take: limit,
        skip: offset,
      }),
      prisma.organization.count({ where })
    ]);

    return NextResponse.json({
      orgs,
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
    const { name, type, website } = body;

    // Validate required fields - only name is truly required
    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: 'Organization name is required' },
        { status: 400 }
      );
    }

    // Validate org type
    const validTypes = ['VENDOR', 'DESIGN_FIRM', 'MANUFACTURER', 'SHOWROOM', 'CONTRACTOR'];
    const orgType = type?.toUpperCase() || 'DESIGN_FIRM';
    if (!validTypes.includes(orgType)) {
      return NextResponse.json(
        { error: `Invalid type. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // Create org with minimal columns (production DB may be missing columns)
    const org = await prisma.$transaction(async (tx) => {
      // Create the organization - minimal fields only
      const newOrg = await tx.organization.create({
        data: {
          name: name.trim(),
          type: orgType,
          website: website?.trim() || null,
        },
      });

      // Add creator as member - minimal fields only
      await tx.organizationUser.create({
        data: {
          userId: session.user.id,
          organizationId: newOrg.id,
          role: 'OWNER',
        },
      });

      return newOrg;
    });

    return NextResponse.json({
      org,
      message: 'Organization created successfully',
    }, { status: 201 });
  } catch (error: any) {
    console.error('[POST /api/orgs] Error:', error);

    if (error.code === 'P2002') {
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
