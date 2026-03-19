export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { assertProjectWrite } from '@/lib/authz/access';
import { syncPullQuotesFromChapters, isPullQuoteSelection } from '@/lib/posting/schemas';

/**
 * PATCH — Select, remove, or restore a pull quote for a chapter.
 *
 * Body: { chapterIndex: number, selectedText: string | null }
 *   - selectedText = "some quote" → select that alternative
 *   - selectedText = null → remove pull quote (keeps alternatives)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { projectId } = params;
    await assertProjectWrite(session.user.id, projectId);

    const body = await request.json();
    const { chapterIndex, selectedText } = body as {
      chapterIndex: number;
      selectedText: string | null;
    };

    if (typeof chapterIndex !== 'number') {
      return NextResponse.json({ error: 'Invalid chapterIndex' }, { status: 400 });
    }

    const post = await prisma.projectPost.findUnique({
      where: { projectId },
      select: { id: true, expandedBlocks: true },
    });

    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    const blocks = (post.expandedBlocks ?? {}) as Record<string, any>;
    const chapters = blocks.galleryChapters as Array<Record<string, any>> | undefined;

    if (!chapters || chapterIndex < 0 || chapterIndex >= chapters.length) {
      return NextResponse.json({ error: 'Invalid chapter index' }, { status: 400 });
    }

    const chapter = chapters[chapterIndex];
    const pq = chapter.pullQuote;

    if (!pq || !isPullQuoteSelection(pq)) {
      // Legacy string format or no pull quote — can't cycle
      if (selectedText === null) {
        chapter.pullQuote = null;
      }
      // Sync and save
      syncPullQuotesFromChapters(blocks);
      await prisma.projectPost.update({
        where: { id: post.id },
        data: { expandedBlocks: blocks as any },
      });
      return NextResponse.json({ ok: true, pullQuote: chapter.pullQuote });
    }

    // New PullQuoteSelection format
    if (selectedText === null) {
      // Remove pull quote — keep alternatives for later restoration
      pq.selected = null;
    } else {
      // Validate that selectedText exists in alternatives
      const alt = pq.alternatives.find((a: any) => a.text === selectedText);
      if (!alt) {
        return NextResponse.json({ error: 'Selected text not found in alternatives' }, { status: 400 });
      }
      pq.selected = { text: alt.text, context: alt.context };
    }

    // Sync top-level pullQuotes array
    syncPullQuotesFromChapters(blocks);

    await prisma.projectPost.update({
      where: { id: post.id },
      data: { expandedBlocks: blocks as any },
    });

    return NextResponse.json({ ok: true, pullQuote: chapter.pullQuote });
  } catch (error: any) {
    if (error.message === 'NotFound') {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    if (error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('[sections/pull-quote] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
