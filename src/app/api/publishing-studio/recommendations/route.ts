import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { revalidatePath } from 'next/cache';
import { Redis } from '@upstash/redis';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { checkRateLimit } from '@/lib/rateLimit';
import { generateQueueForDesigner, EditorialCorpusChangedError } from '@/lib/editorial-queue';
import { canAccessDesignerTools } from '@/lib/permissions';
import { EDITORIAL_QUEUE_MIN_STORIES } from '@/lib/editorial-queue/maturity';
import { resolvePublishingStudioContext, StudioAccessError } from '@/lib/publishing-studio/data';

export const maxDuration = 240;

// Deliberately POST-only: visiting Studio never starts a paid generation run.
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!canAccessDesignerTools(session.user.role)) {
    return NextResponse.json({ error: 'Designer access required' }, { status: 403 });
  }
  const body = await request.json().catch(() => null);
  if (body?.action !== 'refresh') {
    return NextResponse.json({ error: 'Confirm the recommendation refresh' }, { status: 400 });
  }
  try {
    const userId = session.user.id;
    const workspace = await resolvePublishingStudioContext(userId);
    // An authorized organization workspace reviews the practice's published
    // corpus, including work created by other members. Personal work stays private.
    const projects = await prisma.project.findMany({
      where: { ...(workspace.id ? {} : { designerId: userId }), designerOrgId: workspace.id,
        isPublic: true, post: { status: 'PUBLISHED' } },
      select: { id: true }, orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }], take: 100,
    });
    if (projects.length < EDITORIAL_QUEUE_MIN_STORIES) {
      return NextResponse.json({ ok: true, status: 'not_eligible', createdPieces: 0 });
    }
    // Distributed and fail-closed in production; protects paid model calls from
    // repeated clicks across instances. Development uses the existing local store.
    const budget = await checkRateLimit(`publishing-studio:ideas:${userId}:${workspace.id ?? 'personal'}`, {
      max: 1, windowMs: 60 * 60 * 1000,
    });
    if (!budget.success) {
      return NextResponse.json({ error: 'Recommendations were recently refreshed or refresh is temporarily unavailable. Try again later.' }, {
        status: 429, headers: { 'Retry-After': String(Math.max(1, Math.ceil((budget.reset - Date.now()) / 1000))) },
      });
    }
    if (process.env.NODE_ENV === 'production') {
      // The hourly limit uses fixed windows. A short durable lease also covers
      // two clicks straddling a window boundary; it outlives maxDuration and is
      // intentionally left to expire so an interrupted request cannot unlock a
      // newer run. No database connection is held during model calls.
      const redis = new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL!, token: process.env.UPSTASH_REDIS_REST_TOKEN!,
        retry: { retries: 0 },
      });
      const acquired = await redis.set(`publishing-studio:refresh-lease:${userId}:${workspace.id ?? 'personal'}`, 'running', { nx: true, ex: 300 });
      if (!acquired) return NextResponse.json({ error: 'A recommendation refresh is already running' }, { status: 429 });
    }
    const run = await generateQueueForDesigner(userId, workspace.id, 3, {
      organizationId: workspace.id, projectIds: projects.map(project => project.id),
    });
    if (run.extraction.status === 'llm_unavailable'
      || (run.extraction.status === 'persisted' && run.extraction.persistedAngleIds.length > 0 && run.createdQueueItemIds.length === 0)) {
      return NextResponse.json({ error: 'The writing service could not finish your recommendations. Please try again later.' }, { status: 503 });
    }
    revalidatePath('/designer/studio');
    revalidatePath('/designer/queue');
    return NextResponse.json({ ok: true, status: run.extraction.status, createdPieces: run.createdQueueItemIds.length });
  } catch (error) {
    if (error instanceof EditorialCorpusChangedError) return NextResponse.json({ error: error.message }, { status: 409 });
    if (error instanceof StudioAccessError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('[publishing-studio] Recommendation refresh failed');
    return NextResponse.json({ error: 'Unable to refresh recommendations' }, { status: 500 });
  }
}
