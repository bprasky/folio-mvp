export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/orgs/search - Search organizations by name
 * Used in the professionals join flow to find existing orgs
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q');
    const type = searchParams.get('type'); // DESIGNER or VENDOR

    if (!q || q.length < 2) {
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
        // Prioritize claimed/professional orgs
        { status: 'desc' },
        { name: 'asc' },
      ],
      take: 20,
    });

    return NextResponse.json({ organizations });
  } catch (error) {
    console.error('[GET /api/orgs/search] Error:', error);
    return NextResponse.json(
      { error: 'Failed to search organizations' },
      { status: 500 }
    );
  }
}
