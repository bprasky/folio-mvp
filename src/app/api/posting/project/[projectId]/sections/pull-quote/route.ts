export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { assertProjectWrite } from '@/lib/authz/access';
import { syncPullQuotesFromChapters, isPullQuoteSelection, PullQuoteAuthorshipSchema, FolioLineSchema, type PullQuoteSelection } from '@/lib/posting/schemas';
import { loadInterviewAnswers } from '@/lib/posting/loadInterviewAnswers';
import { folioLinesMatchSources } from '@/lib/posting/folioLines';

/** Select within either authorship pool, or switch modes without losing either selection. */
export async function PATCH(request: NextRequest, { params }: { params: { projectId: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { projectId } = params;
    await assertProjectWrite(session.user.id, projectId);
    const body = await request.json().catch(() => null);
    if (!body || !Number.isInteger(body.chapterIndex) || body.chapterIndex < 0 ||
        (body.selectedText !== undefined && (typeof body.selectedText !== 'string' || !body.selectedText.trim())) ||
        (body.selectedText === undefined && body.authorship === undefined)) {
      return NextResponse.json({ error: 'Invalid quote selection' }, { status: 400 });
    }
    if (body.authorship !== undefined && !PullQuoteAuthorshipSchema.safeParse(body.authorship).success) {
      return NextResponse.json({ error: 'Invalid authorship' }, { status: 400 });
    }
    const post = await prisma.projectPost.findUnique({ where: { projectId }, select: { id: true, slug: true, expandedBlocks: true } });
    if (!post?.expandedBlocks) return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    // Clone: the original JSON is the compare-and-swap token below.
    const blocks = structuredClone(post.expandedBlocks) as Record<string, any>;
    const chapter = blocks.galleryChapters?.[body.chapterIndex];
    if (!chapter || chapter.kind === 'gallery') return NextResponse.json({ error: 'Invalid editorial chapter' }, { status: 400 });
    const original = chapter.pullQuote;
    const pq: PullQuoteSelection = isPullQuoteSelection(original) ? original : {
      selected: typeof original === 'string' && original ? { text: original } : null,
      alternatives: typeof original === 'string' && original ? [{ text: original, score: 0 }] : [],
    };
    const authorship = body.authorship ?? pq.authorship ?? 'verbatim';
    if (authorship === 'folio') {
      const lines = pq.folio?.alternatives;
      if (!lines?.length || !lines.every(line => FolioLineSchema.safeParse(line).success) ||
          !folioLinesMatchSources(lines, chapter.title || '', await loadInterviewAnswers(projectId), chapter.body ?? [])) {
        return NextResponse.json({ error: 'Room options are being updated. Refresh and try again.' }, { status: 422 });
      }
      if (body.selectedText !== undefined) {
        const chosen = lines.find(line => line.text === body.selectedText);
        if (chosen === undefined) return NextResponse.json({ error: 'Selected text not found in alternatives' }, { status: 400 });
        pq.folio!.selected = chosen;
      }
      // Mode-only switching must not revive a stale or malformed stored selection.
      const selected = pq.folio!.selected ?? lines[0];
      pq.folio!.selected = selected;
      if (selected && (!lines.some(line => line.text === selected.text) ||
          !folioLinesMatchSources([selected], chapter.title || '', await loadInterviewAnswers(projectId), chapter.body ?? []))) {
        return NextResponse.json({ error: 'Room options are being updated. Refresh and try again.' }, { status: 422 });
      }
    } else if (body.selectedText !== undefined) {
      const chosen = pq.alternatives.find(line => line.text === body.selectedText);
      if (chosen === undefined) return NextResponse.json({ error: 'Selected text not found in alternatives' }, { status: 400 });
      // Copy the full alternative so its provenance survives selection.
      pq.selected = chosen;
    }
    if (authorship === 'verbatim') {
      pq.selected = pq.selected ?? pq.alternatives[0] ?? null;
      if (!pq.selected?.text.trim()) return NextResponse.json({ error: 'Choose an available Folio opening line for this room.' }, { status: 400 });
      if (!pq.alternatives.some(line => line.text === pq.selected!.text)) return NextResponse.json({ error: 'Selected text not found in alternatives' }, { status: 400 });
    }
    pq.authorship = authorship;
    chapter.pullQuote = pq;
    syncPullQuotesFromChapters(blocks);
    const saved = await prisma.projectPost.updateMany({
      where: { id: post.id, expandedBlocks: { equals: post.expandedBlocks } },
      data: { expandedBlocks: blocks as any },
    });
    if (!saved.count) return NextResponse.json({ error: 'The article changed. Refresh and try again.' }, { status: 409 });
    revalidatePath(`/designer/projects/${projectId}/preview`);
    revalidatePath(`/project/${projectId}`);
    if (post.slug) revalidatePath(`/p/${post.slug}`);
    return NextResponse.json({ ok: true, pullQuote: pq });
  } catch (error: any) {
    if (error.message === 'NotFound') return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    if (error.message === 'Forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    console.error('[sections/pull-quote] Request failed');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
