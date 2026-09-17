import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { canAccessDesignerTools } from '@/lib/permissions';
import { getStudioData, StudioAccessError } from '@/lib/publishing-studio/data';

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!canAccessDesignerTools(session.user.role)) return NextResponse.json({ error: 'Designer access required' }, { status: 403 });
  const body = await request.json().catch(() => null);
  if (!['recommended', 'in_progress', 'dismissed'].includes(body?.status)) {
    return NextResponse.json({ error: 'Invalid idea action' }, { status: 400 });
  }
  try {
    const data = await getStudioData(session.user.id);
    const idea = data.ideas.find(item => item.id === params.id);
    if (!idea) return NextResponse.json({ error: 'Idea not available in this workspace' }, { status: 404 });
    if (!['recommended', 'in_progress', 'dismissed'].includes(idea.status)) {
      return NextResponse.json({ error: 'This story is no longer a recommendation' }, { status: 409 });
    }
    const updated = await prisma.editorialQueueItem.updateMany({
      where: { id: idea.id, designerId: session.user.id, status: idea.status,
        angle: { designerId: session.user.id, organizationId: data.workspace.id } },
      data: { status: body.status },
    });
    if (!updated.count) return NextResponse.json({ error: 'The idea changed. Refresh and try again.' }, { status: 409 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof StudioAccessError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: 'Could not update this idea' }, { status: 500 });
  }
}
