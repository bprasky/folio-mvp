// @idor-allow: public-read reason="Public organization search"
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';

// Lazy load Prisma to catch import errors
let prisma: any = null;

async function getPrisma() {
  if (!prisma) {
    try {
      const module = await import('@/lib/prisma');
      prisma = module.prisma;
    } catch (e: any) {
      throw new Error(`Prisma import failed: ${e.message}`);
    }
  }
  return prisma;
}

/**
 * GET /api/orgs/search - Search organizations by name
 * Used in the professionals join flow to find existing orgs
 */
export async function GET(request: NextRequest) {
  const debugInfo: string[] = [];
  debugInfo.push('1. Route handler started');

  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q');
    const type = searchParams.get('type');
    debugInfo.push(`2. Params: q="${q}", type="${type}"`);

    if (!q || q.length < 2) {
      return NextResponse.json(
        { error: 'Search query must be at least 2 characters', debug: debugInfo },
        { status: 400 }
      );
    }

    // Build where clause
    const where: any = {
      name: {
        contains: q,
        mode: 'insensitive',
      },
    };

    // Map role-based type filter to org types
    if (type === 'DESIGNER') {
      where.type = 'DESIGN_FIRM';
    } else if (type === 'ARCHITECT') {
      where.type = 'ARCHITECTURE_FIRM';
    } else if (type === 'BUILDER') {
      where.type = 'CONTRACTOR';
    } else if (type === 'VENDOR') {
      where.type = { in: ['VENDOR', 'MANUFACTURER', 'SHOWROOM'] };
    } else if (type) {
      where.type = type;
    }
    debugInfo.push(`3. Where clause built: ${JSON.stringify(where)}`);

    // Get Prisma client
    debugInfo.push('4. Getting Prisma client...');
    const db = await getPrisma();
    debugInfo.push('5. Prisma client obtained');

    // Minimal query - only columns guaranteed to exist in prod DB
    debugInfo.push('6. Running findMany...');
    const organizations = await db.organization.findMany({
      where,
      select: {
        id: true,
        name: true,
        type: true,
      },
      take: 20,
    });
    debugInfo.push(`7. Query complete, found ${organizations.length} orgs`);

    // Add defaults for missing columns until migrations are run
    const orgsWithDefaults = organizations.map((org: any) => ({
      ...org,
      status: 'UNCLAIMED',
      _count: { users: 0 },
    }));

    return NextResponse.json({
      organizations: orgsWithDefaults,
    });
  } catch (error: any) {
    debugInfo.push(`ERROR: ${error?.message || 'Unknown error'}`);
    debugInfo.push(`ERROR stack: ${error?.stack?.substring(0, 500) || 'No stack'}`);

    console.error('[GET /api/orgs/search] Debug:', debugInfo);
    console.error('[GET /api/orgs/search] Error:', error);

    return NextResponse.json(
      {
        error: 'Failed to search organizations',
        debug: debugInfo,
        errorMessage: error?.message,
        errorCode: error?.code,
      },
      { status: 500 }
    );
  }
}
