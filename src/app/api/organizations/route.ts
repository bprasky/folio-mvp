// @idor-allow: public-read reason="Public organization directory (alternate path)"
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';



export { POST } from '@/app/api/auth/org-setup/route';

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
