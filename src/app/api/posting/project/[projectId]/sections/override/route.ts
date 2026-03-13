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

    const post = await prisma.projectPost.findUnique({
      where: { projectId },
      select: { id: true, expandedBlocks: true, sectionOverrides: true },
    });

    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    const blocks = (post.expandedBlocks ?? {}) as Record<string, any>;
    const overrides = ((post.sectionOverrides ?? []) as SectionOverride[]).slice();

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
  if (chapterIndex === -1) {
    // Lead fields
    return blocks.lead?.[field] ?? '';
  }
  const chapter = blocks.galleryChapters?.[chapterIndex];
  if (!chapter) return '';
  if (field === 'title') return chapter.title ?? '';
  if (field === 'pullQuote') return chapter.pullQuote ?? '';
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
  if (chapterIndex === -1) {
    if (!blocks.lead) blocks.lead = {};
    blocks.lead[field] = value;
    return;
  }
  const chapter = blocks.galleryChapters?.[chapterIndex];
  if (!chapter) return;
  if (field === 'title') chapter.title = value;
  else if (field === 'pullQuote') chapter.pullQuote = value;
  else if (field === 'body' && Array.isArray(chapter.body)) chapter.body[paragraphIndex] = value;
}
