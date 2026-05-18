import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import {
  orgTypeForRole,
  adjacentOrgTypesForRole,
} from '@/lib/onboarding/role-org-mapping';

export const dynamic = 'force-dynamic';

// Typeahead for firm search (17_ONBOARDING_FLOW Step 2).
// Returns up to 8 organizations whose name contains the query, scoped to the
// user's role-matched OrgType. Adjacent OrgTypes are flagged so the UI can
// surface the "Join as X?" cross-suggest prompt.
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const q = request.nextUrl.searchParams.get('q')?.trim() ?? '';
  if (q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const role = session.user.role;
  const primaryType = orgTypeForRole(role);
  if (!primaryType) {
    return NextResponse.json({ results: [] });
  }
  const adjacentTypes = adjacentOrgTypesForRole(role);
  const allTypes = [primaryType, ...adjacentTypes];

  const orgs = await prisma.organization.findMany({
    where: {
      type: { in: allTypes },
      name: { contains: q, mode: 'insensitive' },
    },
    select: {
      id: true,
      name: true,
      type: true,
      location: true,
      _count: { select: { users: true } },
    },
    take: 8,
    orderBy: [{ followerCount: 'desc' }, { name: 'asc' }],
  });

  const results = orgs.map((o) => ({
    id: o.id,
    name: o.name,
    type: o.type,
    location: o.location,
    memberCount: o._count.users,
    adjacent: o.type !== primaryType,
  }));

  return NextResponse.json({ results });
}
