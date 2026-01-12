export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { getUserOrgMemberships } from '@/lib/permissions';

/**
 * POST /api/orgs - Create a new organization
 * Creator becomes OWNER with individual-level permissions within org
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, type, address, website, phone, description } = body;

    // Validate required fields for org creation
    if (!name || !type) {
      return NextResponse.json(
        { error: 'Missing required fields: name, type' },
        { status: 400 }
      );
    }

    // Create organization with creator as OWNER
    const organization = await prisma.organization.create({
      data: {
        name,
        type,
        status: 'UNCLAIMED',
        address,
        website,
        phone,
        description,
        createdBy: session.user.id,
        users: {
          create: {
            userId: session.user.id,
            role: 'OWNER',
          },
        },
      },
      include: {
        users: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                profileImage: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json(organization, { status: 201 });
  } catch (error) {
    console.error('Error creating organization:', error);
    return NextResponse.json(
      { error: 'Failed to create organization' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/orgs - List organizations
 * Supports filtering by type, status, and search query
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q'); // Search query
    const type = searchParams.get('type');
    const status = searchParams.get('status');
    const userId = searchParams.get('userId'); // Filter by membership
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

    const where: any = {};

    // Text search on name
    if (q) {
      where.name = {
        contains: q,
        mode: 'insensitive',
      };
    }

    if (type) {
      where.type = type;
    }

    if (status) {
      where.status = status;
    }

    if (userId) {
      where.users = {
        some: {
          userId,
          isActive: true,
        },
      };
    }

    const [organizations, total] = await Promise.all([
      prisma.organization.findMany({
        where,
        include: {
          users: {
            where: { isActive: true },
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  profileImage: true,
                },
              },
            },
            take: 5, // Only return first 5 members for list view
          },
          _count: {
            select: {
              users: { where: { isActive: true } },
              vendorProjects: true,
              designerProjects: true,
            },
          },
        },
        orderBy: { name: 'asc' },
        take: limit,
        skip: offset,
      }),
      prisma.organization.count({ where }),
    ]);

    return NextResponse.json({
      organizations,
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error('Error fetching organizations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch organizations' },
      { status: 500 }
    );
  }
}
