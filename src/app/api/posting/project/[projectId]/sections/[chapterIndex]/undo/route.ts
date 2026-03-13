export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { assertProjectWrite } from '@/lib/authz/access';
import type { SectionHistoryEntry } from '@/lib/posting/editingTypes';

/**
 * POST — Undo the last regeneration for a chapter.
 * Restores previous body from sectionHistory.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { projectId: string; chapterIndex: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { projectId } = params;
    const chapterIndex = parseInt(params.chapterIndex, 10);
    await assertProjectWrite(session.user.id, projectId);

    if (isNaN(chapterIndex) || chapterIndex < 0) {
      return NextResponse.json({ error: 'Invalid chapter index' }, { status: 400 });
    }

    const post = await prisma.projectPost.findUnique({
      where: { projectId },
      select: { id: true, expandedBlocks: true, sectionHistory: true },
    });

    if (!post?.expandedBlocks) {
      return NextResponse.json({ error: 'No article found' }, { status: 404 });
    }

    const blocks = post.expandedBlocks as Record<string, any>;
    const chapters = blocks.galleryChapters as any[];
    const history = ((post.sectionHistory ?? []) as SectionHistoryEntry[]).slice();

    const entryIdx = history.findIndex((h) => h.chapterIndex === chapterIndex);
    if (entryIdx < 0 || history[entryIdx].versions.length === 0) {
      return NextResponse.json({ error: 'No previous version to restore' }, { status: 404 });
    }

    // Pop the most recent version
    const previousVersion = history[entryIdx].versions.pop()!;

    // Clean up empty history entries
    if (history[entryIdx].versions.length === 0) {
      history.splice(entryIdx, 1);
    }

    // Restore the body
    chapters[chapterIndex].body = previousVersion.body;

    await prisma.projectPost.update({
      where: { id: post.id },
      data: {
        expandedBlocks: blocks as any,
        sectionHistory: history.length > 0 ? (history as any) : null,
      },
    });

    return NextResponse.json({
      ok: true,
      chapter: {
        title: chapters[chapterIndex].title,
        body: previousVersion.body,
      },
    });
  } catch (error: any) {
    if (error.message === 'NotFound') {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    if (error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('[section/undo] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
