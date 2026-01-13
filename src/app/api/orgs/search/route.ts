export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/orgs/search - Search organizations by name
 * Used in the professionals join flow to find existing orgs
 */
export async function GET(request: NextRequest) {
  console.log('[GET /api/orgs/search] Starting request');

  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q');
    const type = searchParams.get('type'); // DESIGNER or VENDOR

    console.log('[GET /api/orgs/search] Params:', { q, type });

    if (!q || q.length < 2) {
      console.log('[GET /api/orgs/search] Query too short');
      return NextResponse.json(
        { error: 'Search query must be at least 2 characters' },
        { status: 400 }
      );
    }

    const where: any = {
      name: {
        contains: q,
        mode: 'insensitive',
      },
    };

    if (type) {
      // Map DESIGNER/VENDOR to org types
      if (type === 'DESIGNER') {
        where.type = 'DESIGN_FIRM';
      } else if (type === 'VENDOR') {
        where.type = { in: ['VENDOR', 'MANUFACTURER', 'SHOWROOM'] };
      } else {
        where.type = type;
      }
    }

    console.log('[GET /api/orgs/search] Where clause:', JSON.stringify(where));

    // First, test basic database connectivity
    console.log('[GET /api/orgs/search] Testing database connection...');
    const dbTest = await prisma.$queryRaw`SELECT 1 as test`;
    console.log('[GET /api/orgs/search] Database connected:', dbTest);

    // Now try a simple count query first
    console.log('[GET /api/orgs/search] Running count query...');
    const count = await prisma.organization.count({ where });
    console.log('[GET /api/orgs/search] Count result:', count);

    // Now try the full query
    console.log('[GET /api/orgs/search] Running findMany query...');
    const organizations = await prisma.organization.findMany({
      where,
      select: {
        id: true,
        name: true,
        type: true,
        status: true,
        website: true,
        address: true,
        logo: true,
        _count: {
          select: {
            users: true,
          },
        },
      },
      orderBy: [
        { status: 'desc' },
        { name: 'asc' },
      ],
      take: 20,
    });

    console.log('[GET /api/orgs/search] Found', organizations.length, 'organizations');

    return NextResponse.json({ organizations });
  } catch (error: any) {
    console.error('[GET /api/orgs/search] Error type:', error?.constructor?.name);
    console.error('[GET /api/orgs/search] Error message:', error?.message);
    console.error('[GET /api/orgs/search] Error code:', error?.code);
    console.error('[GET /api/orgs/search] Full error:', error);
    return NextResponse.json(
      { error: 'Failed to search organizations', debug: error?.message },
      { status: 500 }
    );
  }
}
