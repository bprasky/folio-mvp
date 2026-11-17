// @idor-allow: public-read reason="Organization profile feed: current public firm projects with included photos, and explicitly published org content; selected public fields only"
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getOrgProfileFeed } from '@/lib/profile/org-feed';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { orgId: string } | Promise<{ orgId: string }> }
) {
  try {
    const { orgId } = await params;
    const { searchParams } = new URL(request.url);
    const filter = searchParams.get('filter') || 'all';
    const sort = searchParams.get('sort') || 'featured';
    if (!['all', 'projects', 'media', 'recognition', 'collaborations'].includes(filter) ||
        !['featured', 'recent', 'engagement'].includes(sort)) {
      return NextResponse.json({ error: 'Choose a valid feed category and sort order.' }, { status: 400 });
    }
    if (!await prisma.organization.findUnique({ where: { id: orgId }, select: { id: true } }))
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    const items = await getOrgProfileFeed(orgId, filter, sort);
    return NextResponse.json({ items }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('[GET /api/org/[orgId]/feed] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch feed' },
      { status: 500 }
    );
  }
}
