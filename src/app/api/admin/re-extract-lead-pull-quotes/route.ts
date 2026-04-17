import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { extractPullQuotesForChapter } from '@/lib/posting/generateEditorialDraft';
import { syncPullQuotesFromChapters } from '@/lib/posting/schemas';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/re-extract-lead-pull-quotes
 *
 * Re-runs pull quote extraction on every ProjectPost's stored galleryChapters,
 * applying hook-aware selection for chapter 0. Idempotent — safe to re-run.
 * Existing posts (like the Miami post) pick up the fixed lead pull quote
 * without regenerating the draft through the LLM.
 */
export async function POST(_request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any).role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 403 }
      );
    }

    const posts = await prisma.projectPost.findMany({
      where: { expandedBlocks: { not: null as any } },
      select: {
        id: true,
        slug: true,
        expandedBlocks: true,
        project: { select: { designer: { select: { name: true } } } },
      },
    });

    let updated = 0;
    let unchanged = 0;
    const errors: Array<{ id: string; slug: string; error: string }> = [];

    for (const post of posts) {
      try {
        const blocks = post.expandedBlocks as Record<string, any> | null;
        const chapters = blocks?.galleryChapters;
        if (!Array.isArray(chapters) || chapters.length === 0) {
          unchanged++;
          continue;
        }

        const designerName = post.project?.designer?.name ?? undefined;

        const nextChapters = chapters.map((ch: any, idx: number) => {
          const body = Array.isArray(ch?.body) ? ch.body.filter((p: unknown) => typeof p === 'string') : [];
          if (body.length === 0) return ch;
          const pullQuote = extractPullQuotesForChapter(body, designerName, { isLeadChapter: idx === 0 });
          return { ...ch, pullQuote };
        });

        const nextBlocks: Record<string, any> = { ...blocks, galleryChapters: nextChapters };
        syncPullQuotesFromChapters(nextBlocks);

        const prevSerialized = JSON.stringify(blocks);
        const nextSerialized = JSON.stringify(nextBlocks);
        if (prevSerialized === nextSerialized) {
          unchanged++;
          continue;
        }

        await prisma.projectPost.update({
          where: { id: post.id },
          data: { expandedBlocks: nextBlocks as any },
        });
        updated++;
      } catch (err) {
        errors.push({
          id: post.id,
          slug: post.slug,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return NextResponse.json({
      success: true,
      scanned: posts.length,
      updated,
      unchanged,
      errors,
    });
  } catch (error) {
    console.error('[re-extract-lead-pull-quotes] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to re-extract pull quotes' },
      { status: 500 }
    );
  }
}
