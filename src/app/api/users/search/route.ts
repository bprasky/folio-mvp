export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q')?.trim();
    const role = searchParams.get('role')?.toUpperCase();
    const limit = parseInt(searchParams.get('limit') || '10');

    if (!query || query.length < 2) {
      return NextResponse.json({ users: [] });
    }

    // Build where clause - search by name only (not email) to avoid enumeration
    const whereClause: any = {
      OR: [
        { name: { contains: query, mode: 'insensitive' } },
        { studio: { contains: query, mode: 'insensitive' } },
      ],
    };

    // Add role filter if specified
    if (role && ['ADMIN', 'VENDOR', 'DESIGNER', 'HOMEOWNER', 'GUEST'].includes(role)) {
      whereClause.role = role;
    }

    const users = await prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        role: true,
        profileImage: true,
        studio: true,
      },
      take: limit,
      orderBy: {
        name: 'asc',
      },
    });

    return NextResponse.json({ users });
  } catch (error) {
    console.error('Error searching users:', error);
    return NextResponse.json(
      { error: 'Failed to search users' },
      { status: 500 }
    );
  }
}
