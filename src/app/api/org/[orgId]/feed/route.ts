import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

interface FeedItem {
  id: string;
  type: 'project' | 'media' | 'recognition' | 'collaboration';
  data: any;
  publishedAt: Date | null;
  pinnedAt: Date | null;
  pinOrder: number | null;
  engagement: number;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { orgId: string } | Promise<{ orgId: string }> }
) {
  try {
    const resolvedParams = params instanceof Promise ? await params : params;
    const { searchParams } = new URL(request.url);
    const filter = searchParams.get('filter') || 'all';
    const sort = searchParams.get('sort') || 'featured';
    const limit = 30;

    // Get org members
    const members = await prisma.organizationUser.findMany({
      where: { organizationId: resolvedParams.orgId, isActive: true },
      select: { userId: true },
    });
    const memberIds = members.map(m => m.userId);

    if (memberIds.length === 0) {
      return NextResponse.json({ items: [] });
    }

    const items: FeedItem[] = [];

    // Fetch projects
    if (filter === 'all' || filter === 'projects') {
      const projects = await prisma.project.findMany({
        where: { designerId: { in: memberIds }, isPublic: true },
        include: {
          images: { take: 1, orderBy: { displayOrder: 'asc' } },
          _count: { select: { rooms: true } },
          editorialAssignments: { select: { id: true }, take: 1 },
        },
        orderBy: { publishedAt: 'desc' },
        take: limit,
      });

      items.push(
        ...projects.map(p => ({
          id: p.id,
          type: 'project' as const,
          data: {
            id: p.id,
            name: p.title || 'Untitled Project',
            city: p.city,
            saves: p.saves || 0,
            images: p.images,
            // Enhanced fields for progressive layout
            title: p.title || 'Untitled Project',
            heroImage: p.images[0]?.url || null,
            location: [p.city, p.regionState].filter(Boolean).join(', ') || null,
            isEditorial: (p.editorialAssignments?.length || 0) > 0,
            roomCount: p._count?.rooms || 0,
            saveCount: p.saves || 0,
          },
          publishedAt: p.publishedAt,
          pinnedAt: (p as any).pinnedAt || null,
          pinOrder: (p as any).pinOrder || null,
          engagement: p.saves || 0,
        }))
      );
    }

    // Fetch org media (if model exists and filter matches)
    if (filter === 'all' || filter === 'media') {
      try {
        const media = await (prisma as any).orgMedia?.findMany({
          where: {
            organizationId: resolvedParams.orgId,
            publishedAt: { not: null },
          },
          orderBy: { publishedAt: 'desc' },
          take: limit,
        });

        if (media) {
          items.push(
            ...media.map((m: any) => ({
              id: m.id,
              type: 'media' as const,
              data: m,
              publishedAt: m.publishedAt,
              pinnedAt: m.pinnedAt,
              pinOrder: m.pinOrder,
              engagement: (m.views || 0) + (m.saves || 0),
            }))
          );
        }
      } catch {
        // OrgMedia model might not exist yet
      }
    }

    // Fetch org recognition (if model exists and filter matches)
    if (filter === 'all' || filter === 'recognition') {
      try {
        const recognition = await (prisma as any).orgRecognition?.findMany({
          where: {
            organizationId: resolvedParams.orgId,
            publishedAt: { not: null },
          },
          orderBy: { date: 'desc' },
          take: limit,
        });

        if (recognition) {
          items.push(
            ...recognition.map((r: any) => ({
              id: r.id,
              type: 'recognition' as const,
              data: r,
              publishedAt: r.publishedAt || r.date,
              pinnedAt: r.pinnedAt,
              pinOrder: r.pinOrder,
              engagement: 0,
            }))
          );
        }
      } catch {
        // OrgRecognition model might not exist yet
      }
    }

    // Fetch org collaborations (if model exists and filter matches)
    if (filter === 'all' || filter === 'collaborations') {
      try {
        const collaborations = await (prisma as any).orgCollaboration?.findMany({
          where: {
            organizationId: resolvedParams.orgId,
            publishedAt: { not: null },
          },
          orderBy: { publishedAt: 'desc' },
          take: limit,
        });

        if (collaborations) {
          items.push(
            ...collaborations.map((c: any) => ({
              id: c.id,
              type: 'collaboration' as const,
              data: c,
              publishedAt: c.publishedAt,
              pinnedAt: c.pinnedAt,
              pinOrder: c.pinOrder,
              engagement: 0,
            }))
          );
        }
      } catch {
        // OrgCollaboration model might not exist yet
      }
    }

    // Sort items
    const sortedItems = sortFeedItems(items, sort);

    return NextResponse.json({ items: sortedItems });
  } catch (error) {
    console.error('[GET /api/org/[orgId]/feed] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch feed' },
      { status: 500 }
    );
  }
}

function sortFeedItems(items: FeedItem[], sort: string): FeedItem[] {
  // Pinned items always first
  const pinned = items
    .filter(i => i.pinnedAt)
    .sort((a, b) => (a.pinOrder || 0) - (b.pinOrder || 0));

  let unpinned = items.filter(i => !i.pinnedAt);

  switch (sort) {
    case 'recent':
      unpinned.sort((a, b) => {
        const dateA = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
        const dateB = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
        return dateB - dateA;
      });
      break;

    case 'engagement':
      unpinned.sort((a, b) => b.engagement - a.engagement);
      break;

    case 'featured':
    default:
      // Mix of engagement + recency + diversity
      unpinned = applyDiversitySort(unpinned);
  }

  return [...pinned, ...unpinned];
}

function applyDiversitySort(items: FeedItem[]): FeedItem[] {
  // Score each item
  const scored = items.map(item => {
    let score = 0;

    // Engagement weight
    score += Math.log(item.engagement + 1) * 10;

    // Recency weight (decay over 30 days)
    if (item.publishedAt) {
      const daysSince = (Date.now() - new Date(item.publishedAt).getTime()) / (1000 * 60 * 60 * 24);
      score += Math.max(0, 30 - daysSince);
    }

    // Type diversity boost
    if (item.type === 'recognition') score += 5;
    if (item.type === 'media') score += 3;

    return { ...item, score };
  });

  // Sort by score but enforce diversity (no more than 3 of same type in a row)
  const result: FeedItem[] = [];
  const remaining = [...scored.sort((a, b) => b.score - a.score)];

  while (remaining.length > 0) {
    const lastThree = result.slice(-3);
    const lastType =
      lastThree.length === 3 && lastThree.every(i => i.type === lastThree[0].type)
        ? lastThree[0].type
        : null;

    const nextIndex = remaining.findIndex(i => i.type !== lastType);
    const next = remaining.splice(nextIndex === -1 ? 0 : nextIndex, 1)[0];
    result.push(next);
  }

  return result;
}
