export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { assertProjectWrite } from '@/lib/authz/access';
import { EmbeddedQuoteChoiceSchema } from '@/lib/posting/schemas';
import { savedEmbeddedQuoteChoices } from '@/lib/posting/embeddedQuotes';
import { buildStoryData } from '@/lib/story/buildRoomTiles';
import type { Prisma } from '@prisma/client';

/** Select existing evidence; never accept new quotation text or arbitrary credit. */
export async function PATCH(request: NextRequest, { params }: { params: { projectId: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { projectId } = params;
    await assertProjectWrite(session.user.id, projectId);
    const parsed = EmbeddedQuoteChoiceSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: 'Invalid quote selection' }, { status: 400 });
    const choice = parsed.data;
    const post = await prisma.projectPost.findUnique({ where: { projectId }, select: {
      id: true, status: true, slug: true, expandedBlocks: true,
      project: { select: { isPublic: true, designerOrg: { select: { name: true } },
        designer: { select: { name: true, studio: true } }, images: { select: { id: true, url: true } } } },
      supplementalQuotes: { select: { id: true, answer: true, contributorRole: true, pinned: true }, orderBy: { createdAt: 'asc' } },
    } });
    if (!post?.expandedBlocks) return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    if (post.status !== 'DRAFT' || post.project.isPublic) return NextResponse.json({ error: 'Return the article to draft before editing quotes.' }, { status: 409 });
    const slot = buildStoryData(post)?.breathers.find(quote => quote.id === choice.slotId);
    const selected = slot?.options.find(option => option.sourceId === choice.sourceId && option.text === choice.text);
    if (!slot || !selected) return NextResponse.json({ error: 'This quote is no longer available. Refresh and choose another.' }, { status: 422 });
    if (!selected.contributorAttribution && choice.attribution && !slot.credits[choice.attribution]) {
      return NextResponse.json({ error: 'This attribution is not available.' }, { status: 400 });
    }
    // Contributor credit is fixed; it cannot be reassigned to this designer or org.
    if (selected.contributorAttribution) delete choice.attribution;
    const blocks = structuredClone(post.expandedBlocks) as Record<string, unknown>;
    blocks.embeddedQuotes = [...savedEmbeddedQuoteChoices(blocks).filter(item => item.slotId !== choice.slotId), choice];
    const saved = await prisma.projectPost.updateMany({
      where: { id: post.id, status: 'DRAFT', project: { isPublic: false }, expandedBlocks: { equals: post.expandedBlocks } },
      data: { expandedBlocks: blocks as Prisma.InputJsonValue },
    });
    if (!saved.count) return NextResponse.json({ error: 'The article changed. Refresh and try again.' }, { status: 409 });
    revalidatePath(`/project/${projectId}`);
    revalidatePath(`/designer/projects/${projectId}/preview`);
    if (post.slug) revalidatePath(`/p/${post.slug}`);
    return NextResponse.json({ ok: true, choice });
  } catch (error) {
    if (error instanceof Error && error.message === 'NotFound') return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    if (error instanceof Error && error.message === 'Forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    console.error('[sections/embedded-quote] Request failed');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
