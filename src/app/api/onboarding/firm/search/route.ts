import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { normalizeFirmName, type FirmMatch } from '@/lib/onboarding/firm-name';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const query = request.nextUrl.searchParams.get('q')?.trim() ?? '';
  if (query.length < 2) return NextResponse.json({ results: [] });
  if (query.length > 120) return NextResponse.json({ error: 'Firm name is too long.' }, { status: 400 });
  try {
    const key = normalizeFirmName(query);
    // Search every firm type so a hybrid organization never disappears.
    const results = await prisma.$queryRaw<FirmMatch[]>`
      SELECT id, name, type, location FROM organizations
      WHERE strpos(lower(btrim(regexp_replace(name, '[[:space:]]+', ' ', 'g'))), ${key}) > 0
      ORDER BY (lower(btrim(regexp_replace(name, '[[:space:]]+', ' ', 'g'))) = ${key}) DESC, name, id
      LIMIT 8
    `;
    return NextResponse.json({ results });
  } catch (error) {
    console.error('[firm enrollment] Search failed:', error);
    return NextResponse.json({ error: 'Could not search firms. Please try again.' }, { status: 503 });
  }
}
