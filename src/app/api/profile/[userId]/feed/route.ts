export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getPersonProfileFeed } from '@/lib/profile/person-feed';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';

export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } | Promise<{ userId: string }> }
) {
  const resolvedParams = params instanceof Promise ? await params : params;
  const { searchParams } = new URL(request.url);
  const filter = searchParams.get('filter') || 'all';
  const sort = searchParams.get('sort') || 'featured';
  const cursor = searchParams.get('cursor');
  const limit = 20;

  const session = await getServerSession(authOptions);
  const viewerId = session?.user?.id;
  const viewerRole = session?.user?.role;

  const sorted = await getPersonProfileFeed(resolvedParams.userId, filter, sort, viewerRole);
  return NextResponse.json({
    items: sorted,
    nextCursor: sorted.length === limit ? sorted[sorted.length - 1].id : null,
  });
}
