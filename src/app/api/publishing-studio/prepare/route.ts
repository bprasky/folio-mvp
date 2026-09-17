import { createHash } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { canAccessDesignerTools } from '@/lib/permissions';
import { getStudioData, StudioAccessError } from '@/lib/publishing-studio/data';
import { preparedConfig } from '@/lib/publishing-studio/feed';

/** Explicit polish action persists the already-visible proposal once, never regenerates it. */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!canAccessDesignerTools(session.user.role)) return NextResponse.json({ error: 'Designer access required' }, { status: 403 });
  const body = await request.json().catch(() => null);
  if (typeof body?.cardId !== 'string' || body.cardId.length > 200) return NextResponse.json({ error: 'Choose an available idea' }, { status: 400 });
  try {
    const userId = session.user.id;
    const data = await getStudioData(userId);
    const id = `studio_${createHash('sha256').update(`${userId}\0${body.cardId}`).digest('hex').slice(0, 40)}`;
    const existing = await prisma.instagramExport.findUnique({ where: { id }, select: { id: true, projectId: true, designerId: true } });
    if (existing) {
      const project = data.projects.find(p => p.id === existing.projectId);
      if (existing.designerId !== userId || !project?.canCreateCampaign) throw new StudioAccessError('Draft is not available in this workspace', 404);
      return NextResponse.json({ href: `/designer/projects/${existing.projectId}/instagram?export=${existing.id}`, exportId: existing.id });
    }
    const card = data.feed.find(c => c.id === body.cardId);
    if (!card) throw new StudioAccessError('Idea is no longer available. Refresh the Studio.', 404);
    if (body.revision !== card.revision) throw new StudioAccessError('This idea changed. Refresh the Studio to see the latest preview.', 409);
    if (card.kind !== 'suggestion' || !card.canPolish || !card.imageUrl || card.projectIds.length !== 1) {
      throw new StudioAccessError('This idea is not available to edit', 403);
    }
    const draft = await prisma.instagramExport.upsert({
      where: { id }, update: {},
      create: { id, projectId: card.projectIds[0], designerId: userId, config: preparedConfig(card),
        headline: card.title, caption: card.caption, status: 'draft' },
      select: { id: true, projectId: true },
    });
    return NextResponse.json({ href: `/designer/projects/${draft.projectId}/instagram?export=${draft.id}`, exportId: draft.id });
  } catch (error) {
    if (error instanceof StudioAccessError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: 'Could not open this draft. Please try again.' }, { status: 500 });
  }
}
