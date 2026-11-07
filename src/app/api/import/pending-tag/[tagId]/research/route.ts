import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { assertProjectWrite } from '@/lib/authz/access';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { scheduleReview, scheduleCanRun, type ScheduleReview } from '@/lib/import-agent/finishScheduleReview';
import { matchScheduleRow, researchScheduleRow } from '@/lib/import-agent/researchFinishSchedule';
export const runtime = 'nodejs';
export const maxDuration = 120;

// Provider messages can contain private URLs or payloads. Log only safe diagnostics.
function logProcessingFailure(stage: string, tagId: string, error: unknown) {
  const value = error as { name?: unknown; status?: unknown; request_id?: unknown } | null;
  const token = (input: unknown) => typeof input === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(input) ? input : undefined;
  console.error('[finish-schedule/research]', { stage, tagId, errorType: token(value?.name),
    status: typeof value?.status === 'number' ? value.status : undefined,
    requestId: token(value?.request_id) });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ tagId: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { tagId } = await params;
    const tag = await prisma.pendingProductTag.findUnique({ where: { id: tagId }, include: { importSession: true } });
    if (!tag?.importSession.projectId) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    try { await assertProjectWrite(session.user.id, tag.importSession.projectId); }
    catch { return NextResponse.json({ error: 'Not permitted' }, { status: 403 }); }
    const review = scheduleReview(tag.topSuggestion);
    if (tag.source !== 'SPEC' || tag.status !== 'UNREVIEWED' || !review) return NextResponse.json({ error: 'Not an open schedule item' }, { status: 409 });
    const body = await req.json().catch(() => ({}));
    if (!scheduleCanRun(review, body.retry === true)) return NextResponse.json({ review });
    const running = { finishSchedule: { ...review, state: 'processing', startedAt: Date.now() } } as unknown as Prisma.InputJsonValue;
    // Compare-and-swap lease prevents duplicate tabs from spending twice or racing a review.
    const claim = await prisma.pendingProductTag.updateMany({ where: {
      id: tagId, status: 'UNREVIEWED', topSuggestion: { equals: tag.topSuggestion as Prisma.InputJsonValue },
    }, data: { topSuggestion: running } });
    if (!claim.count) return NextResponse.json({ busy: true }, { status: 202 });
    let completed: ScheduleReview;
    try {
      const photos = await prisma.projectImage.findMany({ where: { projectId: tag.importSession.projectId },
        include: { assignedRoom: { select: { name: true } } }, orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
      });
      const [visual, research] = await Promise.allSettled([
        matchScheduleRow(review.row, photos, tag.importSession.projectId), researchScheduleRow(review.row),
      ]);
      const warnings: string[] = [];
      if (visual.status === 'rejected') {
        logProcessingFailure('photo-matching', tagId, visual.reason);
        warnings.push('Photo matching failed. Retry or place this item manually.');
      }
      else if (!visual.value.length) warnings.push('No confident match in the scheduled room. Check the room or place manually.');
      if (research.status === 'rejected') {
        logProcessingFailure('product-search', tagId, research.reason);
        warnings.push('Product search failed. Retry to fill missing fields.');
      }
      else if (!research.value) warnings.push('No source-backed product result found. Details remain from your schedule.');
      else if (!research.value.exact || research.value.confidence === 'low') warnings.push('Only a similar or uncertain product was found. Its fields have not been applied.');
      completed = { ...review, state: visual.status === 'rejected' || research.status === 'rejected' ? 'failed' : 'done',
        matches: visual.status === 'fulfilled' ? visual.value : review.matches,
        research: research.status === 'fulfilled' ? research.value : review.research, warnings };
    } catch (error) {
      logProcessingFailure('processing', tagId, error);
      completed = { ...review, state: 'failed', warnings: ['Processing failed. Your schedule is saved; retry this item.'] };
    }
    // Keep source columns unchanged. Researched values are proposals until confirmed.
    await prisma.pendingProductTag.updateMany({ where: { id: tagId, status: 'UNREVIEWED', topSuggestion: { equals: running } },
      data: { topSuggestion: { finishSchedule: completed } as unknown as Prisma.InputJsonValue } });
    return NextResponse.json({ review: completed });
  } catch (error) {
    console.error('[finish-schedule/research]', error);
    return NextResponse.json({ error: 'Could not process this item. Retry shortly.' }, { status: 500 });
  }
}
