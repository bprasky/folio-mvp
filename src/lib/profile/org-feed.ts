import { prisma } from '@/lib/prisma';
import { publishedProjectHref } from '@/lib/post/published-story-href';
import { getPublicCoverage } from '@/lib/coverage/service';
import { coverageFeedItems } from '@/lib/coverage/feed';
interface FeedItem {
  id: string;
  type: 'project' | 'media' | 'recognition' | 'collaboration';
  data: Record<string, unknown>;
  publishedAt: Date | null;
  pinnedAt: Date | null;
  pinOrder: number | null;
  engagement: number;
}


export async function getOrgProfileFeed(orgId: string, filter = 'all', sort = 'featured') {
  const limit = 30;
    const organization = await prisma.organization.findUnique({ where: { id: orgId }, select: { id: true } });
    if (!organization) return [];
    const items: FeedItem[] = [];

    // Fetch projects
    if (filter === 'all' || filter === 'projects') {
      const projects = await prisma.project.findMany({
        where: { designerOrgId: orgId, isPublic: true, publishedAt: { lte: new Date() } },
        select: {
          id: true, title: true, city: true, regionState: true, saves: true,
          publishedAt: true, pinnedAt: true, pinOrder: true,
          isPublic: true, portfolioPublishedAt: true,
          images: { where: { inclusion: 'INCLUDED' }, select: { url: true }, take: 1, orderBy: { displayOrder: 'asc' } },
          _count: { select: { rooms: true } },
          post: { select: { status: true, slug: true } },
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
            isEditorial: p.post?.status === 'PUBLISHED',
            storyHref: publishedProjectHref(p),
            roomCount: p._count.rooms,
            saveCount: p.saves || 0,
          },
          publishedAt: p.publishedAt,
          pinnedAt: p.pinnedAt,
          pinOrder: p.pinOrder,
          engagement: p.saves || 0,
        }))
      );
    }

    // Explicit DTOs keep author-only metadata out of this public endpoint.
    if (filter === 'all' || filter === 'media') {
      const media = await prisma.orgMedia.findMany({
        where: { organizationId: orgId, publishedAt: { lte: new Date() } },
        select: { id: true, type: true, title: true, thumbnailUrl: true, duration: true, views: true, saves: true,
          publishedAt: true, pinnedAt: true, pinOrder: true },
        orderBy: { publishedAt: 'desc' }, take: limit,
      });
      items.push(...media.map(m => ({
        id: m.id, type: 'media' as const,
        data: { id: m.id, type: m.type, title: m.title, thumbnailUrl: m.thumbnailUrl, duration: m.duration, views: m.views },
        publishedAt: m.publishedAt, pinnedAt: m.pinnedAt, pinOrder: m.pinOrder, engagement: m.views + m.saves,
      })));
    }

    if (filter === 'all' || filter === 'recognition') {
      const recognition = await prisma.orgRecognition.findMany({
        where: { organizationId: orgId, publishedAt: { lte: new Date() } },
        select: { id: true, type: true, title: true, source: true, sourceLogoUrl: true, date: true,
          url: true, imageUrl: true, excerpt: true, publishedAt: true, pinnedAt: true, pinOrder: true },
        orderBy: { date: 'desc' }, take: limit,
      });
      items.push(...recognition.map(r => ({
        id: r.id, type: 'recognition' as const,
        data: { id: r.id, type: r.type, title: r.title, source: r.source, sourceLogoUrl: r.sourceLogoUrl,
          date: r.date, url: publicLink(r.url), imageUrl: r.imageUrl, excerpt: r.excerpt },
        publishedAt: r.publishedAt, pinnedAt: r.pinnedAt, pinOrder: r.pinOrder, engagement: 0,
      })));
    }

    if (filter === 'all' || filter === 'collaborations') {
      const collaborations = await prisma.orgCollaboration.findMany({
        where: { organizationId: orgId, publishedAt: { lte: new Date() } },
        select: { id: true, type: true, title: true, description: true, partnerName: true,
          partnerLogoUrl: true, imageUrl: true, publishedAt: true, pinnedAt: true, pinOrder: true },
        orderBy: { publishedAt: 'desc' }, take: limit,
      });
      items.push(...collaborations.map(c => ({
        id: c.id, type: 'collaboration' as const,
        data: { id: c.id, type: c.type, title: c.title, description: c.description,
          partnerName: c.partnerName, partnerLogoUrl: c.partnerLogoUrl, imageUrl: c.imageUrl },
        publishedAt: c.publishedAt, pinnedAt: c.pinnedAt, pinOrder: c.pinOrder, engagement: 0,
      })));
    }

    if (filter === 'all' || filter === 'recognition') items.push(...coverageFeedItems(await getPublicCoverage({ type: 'organization', id: orgId })));
    // Sort items
    const sortedItems = sortFeedItems(items, sort);


  return JSON.parse(JSON.stringify(sortedItems)) as Array<Omit<FeedItem, 'publishedAt' | 'pinnedAt'> & { publishedAt: string | null; pinnedAt: string | null }>;
}
function publicLink(value: string | null): string | null {
  if (!value) return null;
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) ? url.href : null; }
  catch { return null; }
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
