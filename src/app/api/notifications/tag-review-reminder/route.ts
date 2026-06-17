export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';

/**
 * POST { projectId } — when a designer leaves the tagger with tags still
 * awaiting review, drop a single self-notification so they can be pulled back
 * in. A tag "needs review" when its product went through a deferred scrape
 * (scrapeStatus set) and the tag has not been confirmed (reviewedAt null).
 *
 * Deduped per project: any prior unread reminder for the same project is
 * replaced, so repeated exits don't pile up.
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { projectId } = await request.json();
  if (!projectId) {
    return NextResponse.json({ error: 'projectId required' }, { status: 400 });
  }

  // Authorize: only the project owner gets reminders about their own tags.
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { ownerId: true },
  });
  if (!project || project.ownerId !== session.user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const count = await prisma.productTag.count({
    where: {
      reviewedAt: null,
      product: { scrapeStatus: { not: null } },
      image: { projectId },
    },
  });

  // Replace any stale unread reminder for this project (dedupe by metadata).
  const existing = await prisma.notification.findMany({
    where: { userId: session.user.id, read: false, type: 'TAG_REVIEW_READY' },
    select: { id: true, metadata: true },
  });
  const staleIds = existing
    .filter((n) => (n.metadata as any)?.projectId === projectId)
    .map((n) => n.id);
  if (staleIds.length) {
    await prisma.notification.deleteMany({ where: { id: { in: staleIds } } });
  }

  if (count === 0) {
    return NextResponse.json({ created: false, count: 0 });
  }

  await prisma.notification.create({
    data: {
      userId: session.user.id,
      type: 'TAG_REVIEW_READY',
      title: 'Tags ready to review',
      body: `${count} product ${count === 1 ? 'tag is' : 'tags are'} ready to review.`,
      actionUrl: `/project/${projectId}?action=tag-by-hand`,
      metadata: { projectId, count },
    },
  });

  return NextResponse.json({ created: true, count });
}
