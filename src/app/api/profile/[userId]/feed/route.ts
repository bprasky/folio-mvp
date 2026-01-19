export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';

type FeedItem = {
  id: string;
  type: 'project' | 'media' | 'recognition' | 'collaboration';
  data: any;
  publishedAt: Date | null;
  pinnedAt: Date | null;
  pinOrder: number | null;
  engagement: number;
};

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

  // Fetch all content types based on filter
  let projects: any[] = [];
  let media: any[] = [];
  let recognition: any[] = [];
  let collaborations: any[] = [];

  const baseWhere = {
    userId: resolvedParams.userId,
    publishedAt: { not: null },
  };

  if (filter === 'all' || filter === 'projects') {
    projects = await prisma.project.findMany({
      where: {
        designerId: resolvedParams.userId,
        isPublic: true,
      },
      include: {
        images: { take: 1, orderBy: { displayOrder: 'asc' } },
      },
      orderBy: { publishedAt: 'desc' },
      take: limit,
    });
  }

  if (filter === 'all' || filter === 'media') {
    media = await prisma.media.findMany({
      where: baseWhere,
      orderBy: { publishedAt: 'desc' },
      take: limit,
    });
  }

  if (filter === 'all' || filter === 'recognition') {
    recognition = await prisma.recognition.findMany({
      where: baseWhere,
      orderBy: { date: 'desc' },
      take: limit,
    });
  }

  if (filter === 'all' || filter === 'collaborations') {
    collaborations = await prisma.collaboration.findMany({
      where: baseWhere,
      include: {
        vendor: { select: { name: true, logo: true } },
        partner: { select: { name: true, profileImage: true } },
      },
      orderBy: { publishedAt: 'desc' },
      take: limit,
    });
  }

  // Normalize into unified feed items
  const feedItems: FeedItem[] = [
    ...projects.map(p => ({
      id: p.id,
      type: 'project' as const,
      data: {
        ...p,
        imageUrl: p.images?.[0]?.url,
        saveCount: p.saves || 0,
      },
      publishedAt: p.publishedAt,
      pinnedAt: p.pinnedAt,
      pinOrder: p.pinOrder,
      engagement: p.saves || 0,
    })),
    ...media.map(m => ({
      id: m.id,
      type: 'media' as const,
      data: m,
      publishedAt: m.publishedAt,
      pinnedAt: m.pinnedAt,
      pinOrder: m.pinOrder,
      engagement: (m.views || 0) + (m.saves || 0),
    })),
    ...recognition.map(r => ({
      id: r.id,
      type: 'recognition' as const,
      data: r,
      publishedAt: r.publishedAt || r.date,
      pinnedAt: r.pinnedAt,
      pinOrder: r.pinOrder,
      engagement: 0,
    })),
    ...collaborations.map(c => ({
      id: c.id,
      type: 'collaboration' as const,
      data: {
        ...c,
        partnerName: c.partnerName || c.partner?.name || c.vendor?.name,
        partnerLogo: c.partnerLogoUrl || c.partner?.profileImage || c.vendor?.logo,
      },
      publishedAt: c.publishedAt,
      pinnedAt: c.pinnedAt,
      pinOrder: c.pinOrder,
      engagement: 0,
    })),
  ];

  // Sort based on preference
  const sorted = sortFeedItems(feedItems, sort, viewerRole || undefined);

  return NextResponse.json({
    items: sorted,
    nextCursor: sorted.length === limit ? sorted[sorted.length - 1].id : null,
  });
}

function sortFeedItems(items: FeedItem[], sort: string, viewerRole?: string): FeedItem[] {
  // Pinned items always first
  const pinned = items
    .filter(i => i.pinnedAt)
    .sort((a, b) => (a.pinOrder || 0) - (b.pinOrder || 0));
  const unpinned = items.filter(i => !i.pinnedAt);

  // Sort unpinned based on preference
  let sortedUnpinned: FeedItem[];
  switch (sort) {
    case 'recent':
      sortedUnpinned = unpinned.sort((a, b) => {
        const dateA = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
        const dateB = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
        return dateB - dateA;
      });
      break;
    case 'engagement':
      sortedUnpinned = unpinned.sort((a, b) => b.engagement - a.engagement);
      break;
    case 'featured':
    default:
      // Mix of engagement + recency + diversity
      sortedUnpinned = applyDiversitySort(unpinned, viewerRole);
  }

  return [...pinned, ...sortedUnpinned];
}

function applyDiversitySort(items: FeedItem[], viewerRole?: string): FeedItem[] {
  // Score each item
  const scored = items.map(item => {
    let score = 0;

    // Engagement weight
    score += Math.log(item.engagement + 1) * 10;

    // Recency weight (decay over 30 days)
    const publishedDate = item.publishedAt ? new Date(item.publishedAt).getTime() : 0;
    const daysSince = (Date.now() - publishedDate) / (1000 * 60 * 60 * 24);
    score += Math.max(0, 30 - daysSince);

    // Viewer-based boost
    if (viewerRole === 'VENDOR' && item.type === 'collaboration') score += 20;
    if (viewerRole === 'INDIVIDUAL' && item.type === 'recognition') score += 15;
    if (viewerRole === 'DESIGNER' && item.type === 'media') score += 10;

    return { ...item, score };
  });

  // Sort by score but enforce diversity (no more than 3 of same type in a row)
  const result: FeedItem[] = [];
  const remaining = [...scored.sort((a, b) => b.score - a.score)];

  while (remaining.length > 0) {
    // Check last 3 items in result
    const lastThree = result.slice(-3);
    const lastType =
      lastThree.length === 3 && lastThree.every(i => i.type === lastThree[0].type)
        ? lastThree[0].type
        : null;

    // Find next item (skip if same type as last 3)
    const nextIndex = remaining.findIndex(i => i.type !== lastType);
    const next = remaining.splice(nextIndex === -1 ? 0 : nextIndex, 1)[0];
    result.push(next);
  }

  return result;
}
