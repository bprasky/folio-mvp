export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/search/all?q=searchterm&limit=5
 * Search for users and organizations by name (public discovery search)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q')?.trim();
    const limit = Math.min(parseInt(searchParams.get('limit') || '5'), 10);

    if (!q || q.length < 2) {
      return NextResponse.json({ users: [], organizations: [] });
    }

    // Search users and orgs in parallel
    const [users, organizations] = await Promise.all([
      prisma.user.findMany({
        where: {
          accountStatus: 'APPROVED',
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { studio: { contains: q, mode: 'insensitive' } },
          ],
        },
        select: {
          id: true,
          name: true,
          role: true,
          profileImage: true,
          location: true,
          title: true,
          studio: true,
        },
        take: limit,
        orderBy: { name: 'asc' },
      }),
      prisma.organization.findMany({
        where: {
          name: { contains: q, mode: 'insensitive' },
        },
        select: {
          id: true,
          name: true,
          type: true,
          logo: true,
          location: true,
          description: true,
        },
        take: limit,
        orderBy: { name: 'asc' },
      }),
    ]);

    return NextResponse.json({ users, organizations });
  } catch (error) {
    console.error('[GET /api/search/all] Error:', error);
    return NextResponse.json(
      { error: 'Failed to search' },
      { status: 500 }
    );
  }
}
