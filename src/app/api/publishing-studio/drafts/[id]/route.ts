import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { revalidatePath } from 'next/cache';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { canAccessDesignerTools } from '@/lib/permissions';
import { getStudioData, resolvePublishingStudioContext, StudioAccessError } from '@/lib/publishing-studio/data';

/** Discard only the actor's explicitly selected, unchanged saved draft. */
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!canAccessDesignerTools(session.user.role)) return NextResponse.json({ error: 'Designer access required' }, { status: 403 });
  const body = await request.json().catch(() => null);
  if (typeof body?.updatedAt !== 'string' || !Number.isFinite(Date.parse(body.updatedAt))) {
    return NextResponse.json({ error: 'Refresh this draft before removing it.' }, { status: 400 });
  }
  try {
    const actor = session.user.id;
    const data = await getStudioData(actor);
    const card = data.feed.find(item => item.kind === 'carousel' && item.exportId === params.id);
    if (!card || !card.canPolish) throw new StudioAccessError('Draft is not available in this workspace.', 404);
    if (card.status !== 'draft') throw new StudioAccessError('Only saved drafts can be removed here.', 409);
    await prisma.$transaction(async tx => {
      const user = await tx.user.findUnique({ where: { id: actor }, select: { role: true } });
      if (!user || !canAccessDesignerTools(user.role)) throw new StudioAccessError('Designer access required', 403);
      const workspace = await resolvePublishingStudioContext(actor, tx);
      if (workspace.id !== data.workspace.id) throw new StudioAccessError('Your workspace changed. Refresh before removing this draft.', 409);
      const ownedProject = { OR: [{ ownerId: actor }, { designerId: actor }] };
      const deleted = await tx.instagramExport.deleteMany({ where: {
        id: params.id, designerId: actor, status: 'draft', updatedAt: new Date(body.updatedAt),
        exportedAt: null, imageUrls: { equals: [] },
        project: { designerOrgId: workspace.id, ...(workspace.id && workspace.canWriteCampaigns ? {} : ownedProject) },
      } });
      if (deleted.count !== 1) throw new StudioAccessError('This draft changed or is no longer available. Refresh before trying again.', 409);
    }, { isolationLevel: 'Serializable' });
    revalidatePath('/designer/studio');
    return NextResponse.json({ removed: true });
  } catch (error) {
    if (error instanceof StudioAccessError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: 'Could not remove this draft. Refresh to check your saved work.' }, { status: 500 });
  }
}
