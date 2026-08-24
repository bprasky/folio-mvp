export const dynamic = 'force-dynamic';

/**
 * POST — Fill in missing pull quotes on an article that already exists.
 *
 * Pull quotes are not written, they are CUT from the designer's own interview
 * answers by code (`extractQuoteCandidates`); a model only ranks the candidates
 * and returns ids. That is what makes this safe to run after the fact: the
 * candidates depend on the answers, not on the prose, so filling them in changes
 * nothing a reader has already read.
 *
 * It exists because articles generated before the room-attribution fix have
 * `pullQuote: null` on every chapter. Answers reached the selector with no room
 * (they persist `roomId`, never a room name), so `byRoom` was keyed under the
 * single room "General", no chapter title matched, and every chapter's quote was
 * cleared. Those articles have perfectly good quotable answers sitting in the
 * interview and no way to reach them short of regenerating the whole feature —
 * which rewrites prose the designer may have already edited.
 *
 * Only chapters that currently have NO quote are touched. A quote the designer
 * has already chosen is never overwritten.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';

import { prisma } from '@/lib/prisma';
import { assertProjectWrite } from '@/lib/authz/access';
import { selectPullQuotes } from '@/lib/posting/selectPullQuotes';
import { loadInterviewAnswers } from '@/lib/posting/loadInterviewAnswers';
import { syncPullQuotesFromChapters, getSelectedPullQuoteText } from '@/lib/posting/schemas';
import { cid as newCid } from '@/lib/utils/correlation';

export async function POST(
  request: NextRequest,
  { params }: { params: { projectId: string } },
) {
  const _cid = newCid('pullquote-backfill');
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { projectId } = params;
    await assertProjectWrite(session.user.id, projectId);

    const post = await prisma.projectPost.findUnique({
      where: { projectId },
      select: { id: true, expandedBlocks: true },
    });
    if (!post?.expandedBlocks) {
      return NextResponse.json({ error: 'No article to add pull quotes to' }, { status: 404 });
    }

    const blocks = post.expandedBlocks as Record<string, any>;
    const chapters: any[] = Array.isArray(blocks.galleryChapters) ? blocks.galleryChapters : [];
    if (chapters.length === 0) {
      return NextResponse.json({ error: 'This article has no sections yet' }, { status: 404 });
    }

    const answers = await loadInterviewAnswers(projectId);
    if (answers.length === 0) {
      return NextResponse.json(
        {
          error: 'No interview answers found for this project. Pull quotes come from the interview, so there is nothing to choose from yet.',
          code: 'NO_ANSWERS',
        },
        { status: 422 },
      );
    }

    // Rooms the interview actually covered. `selectPullQuotes` keys its result by
    // formatRoomName, which is exactly how chapter titles are written, so the
    // lookup below is direct rather than fuzzy.
    const roomNames = Array.from(new Set(answers.map((a) => a.section).filter(Boolean)));
    const { byRoom, roomsWithNoCandidates, roomsFailedVerification } = await selectPullQuotes(
      roomNames,
      answers,
      _cid,
      projectId,
    );

    let filled = 0;
    const skippedExisting: string[] = [];
    const noCandidate: string[] = [];

    for (const ch of chapters) {
      if (ch?.kind === 'gallery') continue;
      const title = typeof ch?.title === 'string' ? ch.title : '';
      if (!title) continue;

      // Never overwrite a quote the designer already has. Backfill means filling
      // a hole, not re-deciding something they may have chosen deliberately.
      if (getSelectedPullQuoteText(ch.pullQuote)) {
        skippedExisting.push(title);
        continue;
      }

      const selection = Object.prototype.hasOwnProperty.call(byRoom, title) ? byRoom[title] : null;
      if (selection) {
        ch.pullQuote = selection;
        filled++;
      } else {
        noCandidate.push(title);
      }
    }

    if (filled === 0) {
      // Nothing to say but the truth: either every chapter already has one, or
      // the rooms that don't have no quotable answer to offer. Inventing one is
      // the failure this whole path exists to avoid.
      return NextResponse.json({
        ok: true,
        filled: 0,
        skippedExisting,
        noCandidate,
        message:
          skippedExisting.length > 0 && noCandidate.length === 0
            ? 'Every section already has a pull quote.'
            : 'No section had a quotable answer to draw from. Answering a follow-up question about those rooms is what produces one.',
      });
    }

    // Rebuild the top-level index the layout engine reads.
    syncPullQuotesFromChapters(blocks);

    await prisma.projectPost.update({
      where: { id: post.id },
      data: { expandedBlocks: blocks as any },
    });

    console.info('[pullquotes/backfill] filled', {
      _cid, filled, skippedExisting: skippedExisting.length, noCandidate: noCandidate.length,
      roomsWithNoCandidates, roomsFailedVerification,
    });

    return NextResponse.json({ ok: true, filled, skippedExisting, noCandidate });
  } catch (error: any) {
    if (error?.message === 'NotFound') {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    if (error?.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('[pullquotes/backfill] Error', { _cid, error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
