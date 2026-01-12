export const dynamic = 'force-dynamic';

// NOTE (org membership architecture):
// Organizations start as unclaimed - creator gets ADMIN role, not OWNER.
// OWNER role is only assigned when someone claims/verifies the org.
// User.role stays as INDIVIDUAL - user type is derived from org memberships.

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, type, description, website, logo, userId } = body;

    if (!name || !type || !userId) {
      return NextResponse.json(
        { error: 'Missing required fields: name, type, userId' },
        { status: 400 }
      );
    }

    // Create organization and link user as ADMIN (unclaimed org)
    // OWNER role is only assigned when org is claimed/verified
    const organization = await prisma.organization.create({
      data: {
        name,
        type,
        description,
        website,
        logo,
        users: {
          create: {
            userId,
            role: 'ADMIN', // Creator gets ADMIN, not OWNER (unclaimed)
          },
        },
      },
      include: {
        users: {
          include: {
            user: true,
          },
        },
      },
    });

    return NextResponse.json(organization);
  } catch (error) {
    console.error('Error creating organization:', error);
    return NextResponse.json(
      { error: 'Failed to create organization' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const type = searchParams.get('type');

    let where: any = {};

    if (type) {
      where.type = type;
    }

    if (userId) {
      where.users = {
        some: {
          userId,
        },
      };
    }

    const organizations = await prisma.organization.findMany({
      where,
      include: {
        users: {
          include: {
            user: true,
          },
        },
        _count: {
          select: {
            users: true,
            vendorProjects: true,
            designerProjects: true,
          },
        },
      },
    });

    return NextResponse.json(organizations);
  } catch (error) {
    console.error('Error fetching organizations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch organizations' },
      { status: 500 }
    );
  }
} 