export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { assertProjectWrite } from '@/lib/authz/access';
import { checkRateLimit } from '@/lib/rateLimit';
import { loadInterviewAnswers } from '@/lib/posting/loadInterviewAnswers';
import { generateFolioLines } from '@/lib/posting/generateFolioLines';
import { folioLinesMatchSources } from '@/lib/posting/folioLines';
import { FolioLineSchema, isPullQuoteSelection, syncPullQuotesFromChapters, type Blocks, type PullQuoteSelection } from '@/lib/posting/schemas';
import { resolveProductNaming } from '@/lib/naming/resolveProductNaming';
import { scrubProseNaming } from '@/lib/naming/scrubProse';

/** Generate optimized versions independently of the room article, then retain both pools. */
export async function POST(request: NextRequest, { params }: { params: { projectId: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { projectId } = params;
    await assertProjectWrite(session.user.id, projectId);
    const body = await request.json().catch(() => null);
    if (!body || !Number.isInteger(body.chapterIndex) || body.chapterIndex < 0) {
      return NextResponse.json({ error: 'Invalid chapter index' }, { status: 400 });
    }
    const post = await prisma.projectPost.findUnique({ where: { projectId }, select: { id: true, slug: true, expandedBlocks: true } });
    if (!post?.expandedBlocks) return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    const blocks = structuredClone(post.expandedBlocks) as Record<string, any>;
    const chapter = blocks.galleryChapters?.[body.chapterIndex];
    if (!chapter || chapter.kind === 'gallery') return NextResponse.json({ error: 'Invalid editorial chapter' }, { status: 400 });
    const original = chapter.pullQuote;
    const pq: PullQuoteSelection = isPullQuoteSelection(original) ? original : {
      selected: typeof original === 'string' && original ? { text: original } : null,
      alternatives: typeof original === 'string' && original ? [{ text: original, score: 0 }] : [],
    };
    const room = chapter.title || '';
    const answers = await loadInterviewAnswers(projectId);
    let lines = pq.folio?.alternatives ?? [];
    const cached = lines.length > 0 && lines.every(line => FolioLineSchema.safeParse(line).success) &&
      folioLinesMatchSources(lines, room, answers);
    const projectTags = await prisma.productTag.findMany({
      where: { image: { projectId } },
      select: {
        productId: true, imageId: true, finishRaw: true, finishConfirmed: true,
        product: { select: { name: true, brand: true, category: true, description: true } },
      },
    });
    if (!cached) {
      const limit = await checkRateLimit(`folio-lines:${session.user.id}`, { max: 20, windowMs: 60 * 60 * 1000 });
      if (!limit.success) return NextResponse.json(
        { error: 'Too many generation requests. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(Math.max(1, Math.ceil((limit.reset - Date.now()) / 1000))) } },
      );
      const roomImageIds = new Set<string>(chapter.imageIds ?? []);
      const taggedProducts = projectTags.filter(tag => roomImageIds.has(tag.imageId)).map(tag => ({
        productId: tag.productId, name: tag.product.name, brand: tag.product.brand,
        category: tag.product.category, description: tag.product.description?.slice(0, 2000) ?? null,
        // Product has no materials column. Only human-confirmed tag finishes
        // constitute room-specific material evidence; never promote AI guesses.
        finish: tag.finishConfirmed ? tag.finishRaw : null,
      }));
      lines = await generateFolioLines(room, answers, projectId, pq, taggedProducts);
    }
    if (!lines.length || !lines.every(line => FolioLineSchema.safeParse(line).success)) {
      return NextResponse.json({ error: 'Folio could not find a faithful improvement on these quotes. Try adding more detail to this room in your interview.', code: 'NO_FOLIO_LINES' }, { status: 422 });
    }
    // Apply the same commercial naming rule as article generation to the line
    // texts only. Source excerpts remain exact evidence, and article prose is untouched.
    const productIds = projectTags.map(tag => tag.productId);
    const naming = await resolveProductNaming(productIds, { mode: 'prose', projectId, postingUserId: session.user.id });
    const scrubbed = scrubProseNaming({ introduction: lines.map(line => line.text) } as Blocks, naming).blocks.introduction!;
    lines = lines.map((line, index) => ({ ...line, text: scrubbed[index] }));
    if (!lines.every(line => line.text.trim() && FolioLineSchema.safeParse(line).success)) {
      return NextResponse.json({ error: 'Folio could not produce valid versions. Please try again.' }, { status: 502 });
    }
    // A slow model call must not revive an answer removed or made private meanwhile.
    if (!folioLinesMatchSources(lines, room, await loadInterviewAnswers(projectId))) {
      return NextResponse.json({ error: 'The interview changed. Please try again.' }, { status: 409 });
    }
    const selectedIndex = cached ? (pq.folio?.alternatives.findIndex(line => line.text === pq.folio?.selected?.text) ?? -1) : -1;
    pq.folio = {
      selected: cached && pq.folio?.selected === null ? null : lines[selectedIndex >= 0 ? selectedIndex : 0],
      alternatives: lines,
    };
    pq.authorship = 'folio';
    chapter.pullQuote = pq;
    syncPullQuotesFromChapters(blocks);
    // Compare against the original JSON, so generation cannot overwrite intervening edits.
    const saved = await prisma.projectPost.updateMany({
      where: { id: post.id, expandedBlocks: { equals: post.expandedBlocks } },
      data: { expandedBlocks: blocks as any },
    });
    if (!saved.count) return NextResponse.json({ error: 'The article changed. Refresh and try again.' }, { status: 409 });
    revalidatePath(`/designer/projects/${projectId}/preview`);
    revalidatePath(`/project/${projectId}`);
    if (post.slug) revalidatePath(`/p/${post.slug}`);
    return NextResponse.json({ ok: true, pullQuote: pq, cached });
  } catch (error: any) {
    if (error.message === 'NotFound') return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    if (error.message === 'Forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    console.error('[sections/folio-lines] Generation request failed');
    return NextResponse.json({ error: 'Unable to generate Folio versions. Please try again.' }, { status: 500 });
  }
}
