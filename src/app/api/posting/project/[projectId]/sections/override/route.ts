export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { assertProjectWrite } from '@/lib/authz/access';
import type { SectionOverride, SectionOverrideField } from '@/lib/posting/editingTypes';

/**
 * PATCH — Save a paragraph-level edit as an override.
 * Also writes the edit into expandedBlocks so the immersive preview updates.
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
    const { chapterIndex, paragraphIndex, field, editedBody } = body as {
      chapterIndex: number;
      paragraphIndex: number;
      field: SectionOverrideField;
      editedBody: string;
    };

    if (typeof chapterIndex !== 'number' || typeof editedBody !== 'string' || !field) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }

    // Pull quotes are SELECTED, never written.
    //
    // Every candidate is a verbatim span of the designer's own interview answer,
    // and PATCH /sections/pull-quote enforces that by rejecting any selectedText
    // not present in the chapter's `alternatives`. This endpoint took free text
    // and wrote it into `pullQuote.selected.text` — the same field, no check. Two
    // endpoints over one field under two contracts is not a guarantee, it is a
    // back door, and the weaker one wins by definition.
    //
    // Editing prose is the designer's business; a pull quote is a claim about
    // what they said out loud, which is why it is the one field here that cannot
    // be typed into.
    if (field === 'pullQuote') {
      return NextResponse.json(
        {
          error: 'Pull quotes cannot be edited directly — they are verbatim from the interview. Use the pull quote picker to choose a different one.',
          code: 'PULL_QUOTE_NOT_EDITABLE',
        },
        { status: 400 },
      );
    }

    const post = await prisma.projectPost.findUnique({
      where: { projectId },
      select: { id: true, expandedBlocks: true, sectionOverrides: true },
    });

    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    const blocks = (post.expandedBlocks ?? {}) as Record<string, any>;
    const overrides = ((post.sectionOverrides ?? []) as SectionOverride[]).slice();

    // Section editing targets editorial chapters only. Gallery chapters (photo
    // blocks) are not editable. Legacy chapters carry no `kind` and stay editable.
    if (chapterIndex >= 0 && blocks.galleryChapters?.[chapterIndex]?.kind === 'gallery') {
      return NextResponse.json({ error: 'Gallery chapters are not editable' }, { status: 400 });
    }

    // Capture original text from expandedBlocks
    const originalBody = getFieldValue(blocks, chapterIndex, paragraphIndex, field);

    // Skip if no actual change
    if (originalBody === editedBody) {
      return NextResponse.json({ ok: true, overrides });
    }

    // Upsert into overrides array
    const existingIdx = overrides.findIndex(
      (o) => o.chapterIndex === chapterIndex && o.paragraphIndex === paragraphIndex && o.field === field
    );
    const override: SectionOverride = {
      chapterIndex,
      paragraphIndex,
      field,
      originalBody: existingIdx >= 0 ? overrides[existingIdx].originalBody : originalBody,
      editedBody,
      editedAt: new Date().toISOString(),
    };

    if (existingIdx >= 0) {
      overrides[existingIdx] = override;
    } else {
      overrides.push(override);
    }

    // Also write edit into expandedBlocks for immediate preview
    setFieldValue(blocks, chapterIndex, paragraphIndex, field, editedBody);

    await prisma.projectPost.update({
      where: { id: post.id },
      data: {
        sectionOverrides: overrides as any,
        expandedBlocks: blocks as any,
      },
    });

    return NextResponse.json({ ok: true, overrides });
  } catch (error: any) {
    if (error.message === 'NotFound') {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    if (error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('[sections/override] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE — Revert a single override back to original AI text.
 */
export async function DELETE(
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
    const { chapterIndex, paragraphIndex, field } = body as {
      chapterIndex: number;
      paragraphIndex: number;
      field: SectionOverrideField;
    };

    const post = await prisma.projectPost.findUnique({
      where: { projectId },
      select: { id: true, expandedBlocks: true, sectionOverrides: true },
    });

    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    const blocks = (post.expandedBlocks ?? {}) as Record<string, any>;
    const overrides = ((post.sectionOverrides ?? []) as SectionOverride[]).slice();

    // Gallery chapters are not editable (see POST). Legacy chapters stay editable.
    if (chapterIndex >= 0 && blocks.galleryChapters?.[chapterIndex]?.kind === 'gallery') {
      return NextResponse.json({ error: 'Gallery chapters are not editable' }, { status: 400 });
    }

    const idx = overrides.findIndex(
      (o) => o.chapterIndex === chapterIndex && o.paragraphIndex === paragraphIndex && o.field === field
    );

    if (idx < 0) {
      return NextResponse.json({ ok: true, overrides });
    }

    // Restore original text in expandedBlocks
    const original = overrides[idx].originalBody;
    setFieldValue(blocks, chapterIndex, paragraphIndex, field, original);

    // Remove from overrides
    overrides.splice(idx, 1);

    await prisma.projectPost.update({
      where: { id: post.id },
      data: {
        sectionOverrides: overrides as any,
        expandedBlocks: blocks as any,
      },
    });

    return NextResponse.json({ ok: true, overrides });
  } catch (error: any) {
    if (error.message === 'NotFound') {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    if (error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('[sections/override] DELETE Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// --- Helpers ---

function getFieldValue(
  blocks: Record<string, any>,
  chapterIndex: number,
  paragraphIndex: number,
  field: SectionOverrideField
): string {
  if (chapterIndex === -2) {
    // Introduction paragraphs
    return blocks.introduction?.[paragraphIndex] ?? '';
  }
  if (chapterIndex === -1) {
    // Lead fields. `kicker` falls back to a legacy `title` so the recorded
    // original matches what the page actually showed — see setFieldValue.
    if (field === 'kicker') return blocks.lead?.kicker ?? blocks.lead?.title ?? '';
    return blocks.lead?.[field] ?? '';
  }
  const chapter = blocks.galleryChapters?.[chapterIndex];
  if (!chapter) return '';
  if (field === 'title') return chapter.title ?? '';
  if (field === 'pullQuote') {
    const pq = chapter.pullQuote;
    if (!pq) return '';
    if (typeof pq === 'string') return pq;
    // New PullQuoteSelection format
    return pq.selected?.text ?? '';
  }
  if (field === 'body') return chapter.body?.[paragraphIndex] ?? '';
  return '';
}

function setFieldValue(
  blocks: Record<string, any>,
  chapterIndex: number,
  paragraphIndex: number,
  field: SectionOverrideField,
  value: string
): void {
  if (chapterIndex === -2) {
    // Introduction paragraphs
    if (!blocks.introduction) blocks.introduction = [];
    blocks.introduction[paragraphIndex] = value;
    return;
  }
  if (chapterIndex === -1) {
    if (!blocks.lead) blocks.lead = {};
    blocks.lead[field] = value;
    // The headline is written to `kicker`, but several readers still resolve it
    // as `lead.title || lead.kicker` (PostExpanded, buildStoryData). Current
    // generations never persist `title`, so this is inert — but on any row that
    // carries one, writing only `kicker` leaves the stale `title` winning at
    // render and the designer's edit silently does nothing. Keep them in step.
    if (field === 'kicker' && typeof blocks.lead.title === 'string') {
      blocks.lead.title = value;
    }
    return;
  }
  const chapter = blocks.galleryChapters?.[chapterIndex];
  if (!chapter) return;
  if (field === 'title') chapter.title = value;
  else if (field === 'pullQuote') {
    const pq = chapter.pullQuote;
    if (pq && typeof pq === 'object' && 'selected' in pq) {
      // New PullQuoteSelection format — update selected text
      if (pq.selected) {
        pq.selected.text = value;
      } else if (value) {
        pq.selected = { text: value };
      }
    } else {
      // Legacy string format
      chapter.pullQuote = value;
    }
  }
  else if (field === 'body' && Array.isArray(chapter.body)) chapter.body[paragraphIndex] = value;
}
