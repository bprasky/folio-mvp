export const dynamic = 'force-dynamic';
export const maxDuration = 800;

import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { assertProjectWrite } from '@/lib/authz/access';
import { checkRateLimit } from '@/lib/rateLimit';
import { loadInterviewAnswers } from '@/lib/posting/loadInterviewAnswers';
import { prepareRoomTeasers } from '@/lib/posting/prepareRoomTeasers';
import { folioLinesMatchSources, needsRoomTeaserPreparation } from '@/lib/posting/folioLines';

/** Upgrade a legacy draft's selectors without rewriting its room stories. */
export async function POST(_request: NextRequest, { params }: { params: { projectId: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { projectId } = params;
    await assertProjectWrite(session.user.id, projectId);
    const post = await prisma.projectPost.findUnique({ where: { projectId },
      select: { id: true, status: true, slug: true, expandedBlocks: true } });
    if (!post?.expandedBlocks) return NextResponse.json({ error: 'Article not found' }, { status: 404 });
    if (post.status !== 'DRAFT') return NextResponse.json({ error: 'Only drafts can prepare room options automatically.' }, { status: 409 });
    const blocks = structuredClone(post.expandedBlocks) as { galleryChapters?: any[] };
    const chapters = (blocks.galleryChapters ?? []).filter(ch => ch.kind !== 'gallery' && Array.isArray(ch.body) && ch.body.some((p: string) => p.trim()));
    const missing = chapters.filter(needsRoomTeaserPreparation);
    if (!missing.length) return NextResponse.json({ ok: true, filled: 0 });
    const limit = await checkRateLimit(`room-teasers:${session.user.id}`, { max: 10, windowMs: 60 * 60 * 1000 });
    if (!limit.success) return NextResponse.json({ error: 'Room options could not be saved yet. Please try again shortly.' }, { status: 429 });
    const answers = await loadInterviewAnswers(projectId);
    await prepareRoomTeasers(blocks, answers, projectId, { postingUserId: session.user.id });
    const latestAnswers = await loadInterviewAnswers(projectId);
    for (const chapter of chapters) {
      if (!folioLinesMatchSources(chapter.pullQuote.folio.alternatives, chapter.title || '', latestAnswers, chapter.body)) {
        return NextResponse.json({ error: 'The interview changed while preparing options. Please retry.' }, { status: 409 });
      }
    }
    const saved = await prisma.projectPost.updateMany({
      where: { id: post.id, status: 'DRAFT', expandedBlocks: { equals: post.expandedBlocks } },
      data: { expandedBlocks: blocks as any },
    });
    if (!saved.count) return NextResponse.json({ error: 'The article changed while preparing options. Please retry.' }, { status: 409 });
    revalidatePath(`/project/${projectId}`);
    revalidatePath(`/designer/projects/${projectId}/preview`);
    if (post.slug) revalidatePath(`/p/${post.slug}`);
    return NextResponse.json({ ok: true, filled: missing.length });
  } catch (error: any) {
    if (error?.message === 'NotFound') return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    if (error?.message === 'Forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    console.error('[room-teasers] Draft preparation failed');
    return NextResponse.json({ error: 'Room options could not be saved. Please retry.' }, { status: 500 });
  }
}
