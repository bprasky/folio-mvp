export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { assertProjectWrite } from '@/lib/authz/access';
import { checkRateLimit } from '@/lib/rateLimit';
import { buildStoryData } from '@/lib/story/buildRoomTiles';
import { PresentationPatchSchema, readPresentation } from '@/lib/story/presentation';
import { publicationPalette } from '@/lib/server/publication-palette';
import type { Prisma } from '@prisma/client';

type Context = { params: { projectId: string } };
const selectPost = {
  id: true, slug: true, expandedBlocks: true,
  project: { select: { id: true, title: true, images: {
    // Suggestions and published order use the same eligible photographs. Author tags remain untouched.
    where: { inclusion: 'INCLUDED' as const }, orderBy: [{ displayOrder: 'asc' as const }, { id: 'asc' as const }],
    select: { id: true, url: true, roomId: true, room: true },
  } } },
} satisfies Prisma.ProjectPostSelect;

function failure(error: unknown) {
  if (error instanceof Error && error.message === 'NotFound') return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  if (error instanceof Error && error.message.startsWith('Forbidden')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  console.error('[posting/presentation] Request failed');
  return NextResponse.json({ error: 'The publication settings could not be saved. Please retry.' }, { status: 500 });
}

/** Color extraction is requested by the designer; it never changes their chosen theme. */
export async function GET(_request: NextRequest, { params: { projectId } }: Context) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    await assertProjectWrite(session.user.id, projectId);
    const limit = await checkRateLimit(`publication-palette:${session.user.id}`, { max: 12, windowMs: 60_000 });
    if (!limit.success) return NextResponse.json({ error: 'Please wait a moment before finding colors again.' }, { status: 429 });
    const post = await prisma.projectPost.findUnique({ where: { projectId }, select: selectPost });
    if (!post?.expandedBlocks) return NextResponse.json({ error: 'Create the article before choosing its presentation.' }, { status: 404 });
    const presentation = readPresentation((post.expandedBlocks as Record<string, unknown>).presentation);
    const colors = await publicationPalette(projectId, post.project.images.map(image => image.url));
    return NextResponse.json({ presentation, colors }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return failure(error); }
}

export async function PATCH(request: NextRequest, { params: { projectId } }: Context) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    await assertProjectWrite(session.user.id, projectId);
    const parsed = PresentationPatchSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: 'Choose a valid color and room order.' }, { status: 400 });
    const post = await prisma.projectPost.findUnique({ where: { projectId }, select: selectPost });
    if (!post?.expandedBlocks) return NextResponse.json({ error: 'Article not found' }, { status: 404 });
    const blocks = structuredClone(post.expandedBlocks) as Record<string, unknown>;
    const presentation = { ...readPresentation(blocks.presentation), ...parsed.data };
    if (parsed.data.roomOrder) {
      const rooms = new Set(buildStoryData(post)?.roomTiles.map(room => room.roomId) ?? []);
      if (parsed.data.roomOrder.some(id => !rooms.has(id))) return NextResponse.json({ error: 'The rooms changed. Refresh before reordering.' }, { status: 409 });
    }
    blocks.presentation = presentation;
    const saved = await prisma.projectPost.updateMany({
      where: { id: post.id, expandedBlocks: { equals: post.expandedBlocks } },
      data: { expandedBlocks: blocks as Prisma.InputJsonValue },
    });
    if (!saved.count) return NextResponse.json({ error: 'The article changed. Refresh and try again.' }, { status: 409 });
    revalidatePath(`/project/${projectId}`);
    revalidatePath(`/designer/projects/${projectId}/preview`);
    revalidatePath(`/designer/projects/${projectId}/instagram`);
    if (post.slug) revalidatePath(`/p/${post.slug}`);
    return NextResponse.json({ ok: true, presentation });
  } catch (error) { return failure(error); }
}
