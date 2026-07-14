// Editorial Queue — the unlock trigger (docs/17_EDITORIAL_QUEUE.md, the
// three-story gate). Fired fire-and-forget from both publish paths on every
// publish; it decides whether the designer just earned the queue and, if so,
// generates their first recommended pieces and notifies them.
//
// Idempotency key is the unlock Notification: once a designer has been unlocked
// (and there was something to show), the trigger no-ops on later publishes.

import { prisma } from '@/lib/prisma';
import { EDITORIAL_QUEUE_MIN_STORIES } from './maturity';
import { generateQueueForDesigner } from './index';

export const EDITORIAL_QUEUE_UNLOCKED_NOTIFICATION = 'EDITORIAL_QUEUE_UNLOCKED';
const QUEUE_ACTION_URL = '/designer/queue';

export type UnlockResult =
  | { status: 'below_gate'; publishedStories: number }
  | { status: 'already_unlocked' }
  | { status: 'no_pieces_generated' }
  | { status: 'unlocked'; createdPieces: number };

/**
 * Count a designer's PUBLISHED stories and, if they've crossed the three-story
 * gate and haven't been unlocked before, generate their queue and notify them.
 *
 * Notifying only after pieces exist is deliberate: the designer should tap the
 * notification and land on a populated desk, never an empty page. If generation
 * yields nothing (model down, no signals), no notification is written, so a
 * later publish retries cleanly.
 */
export async function maybeUnlockEditorialQueue(
  designerId: string,
  organizationId: string | null,
): Promise<UnlockResult> {
  const publishedStories = await prisma.projectPost.count({
    where: { status: 'PUBLISHED', project: { designerId } },
  });
  if (publishedStories < EDITORIAL_QUEUE_MIN_STORIES) {
    return { status: 'below_gate', publishedStories };
  }

  const alreadyUnlocked = await prisma.notification.findFirst({
    where: { userId: designerId, type: EDITORIAL_QUEUE_UNLOCKED_NOTIFICATION },
    select: { id: true },
  });
  if (alreadyUnlocked) {
    return { status: 'already_unlocked' };
  }

  const run = await generateQueueForDesigner(designerId, organizationId);
  const createdPieces = run.createdQueueItemIds.length;
  if (createdPieces === 0) {
    return { status: 'no_pieces_generated' };
  }

  await prisma.notification.create({
    data: {
      userId: designerId,
      type: EDITORIAL_QUEUE_UNLOCKED_NOTIFICATION,
      title: 'Your editorial desk is open',
      body: `Folio drafted ${createdPieces} ${createdPieces === 1 ? 'story' : 'stories'} from your work. Review and launch them from your queue.`,
      actionUrl: QUEUE_ACTION_URL,
    },
  });

  return { status: 'unlocked', createdPieces };
}

/**
 * Publish-path convenience: resolve the project's designer + org, then run the
 * gate. Safe to call fire-and-forget — never throws into the publish flow.
 */
export async function triggerQueueUnlockForProject(projectId: string): Promise<void> {
  try {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { designerId: true, designerOrgId: true },
    });
    if (!project?.designerId) return;
    const result = await maybeUnlockEditorialQueue(project.designerId, project.designerOrgId);
    if (result.status === 'unlocked') {
      console.log('[editorial-queue] unlocked', { designerId: project.designerId, pieces: result.createdPieces });
    }
  } catch (err) {
    console.error('[editorial-queue] unlock trigger failed (non-fatal)', {
      projectId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
