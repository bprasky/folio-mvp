import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { canAccessDesignerTools } from '@/lib/permissions';
import { getStudioData, StudioAccessError } from '@/lib/publishing-studio/data';

/** Opening validates the visible proposal without creating a saved draft. */
export async function POST(request: NextRequest) {
  if (typeof process !== 'undefined' && process.env.STUDIO_EDITORIAL_READINESS === 'true') return NextResponse.json({ error: 'Review this story in the readiness configurator before exporting.' }, { status: 409 });
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!canAccessDesignerTools(session.user.role)) return NextResponse.json({ error: 'Designer access required' }, { status: 403 });
  const body = await request.json().catch(() => null);
  if (typeof body?.cardId !== 'string' || body.cardId.length > 200) return NextResponse.json({ error: 'Choose an available idea' }, { status: 400 });
  try {
    const userId = session.user.id;
    const data = await getStudioData(userId);
    const card = data.feed.find(c => c.id === body.cardId);
    if (!card) throw new StudioAccessError('Idea is no longer available. Refresh the Studio.', 404);
    if (body.revision !== card.revision) throw new StudioAccessError('This idea changed. Refresh the Studio to see the latest preview.', 409);
    if (card.kind !== 'suggestion' || !card.canPolish || !card.imageUrl || card.projectIds.length !== 1) {
      throw new StudioAccessError('This idea is not available to edit', 403);
    }
    const query = new URLSearchParams({ proposal: card.id, revision: card.revision });
    return NextResponse.json({ href: `/designer/projects/${encodeURIComponent(card.projectIds[0])}/instagram?${query}` });
  } catch (error) {
    if (error instanceof StudioAccessError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: 'Could not open this draft. Please try again.' }, { status: 500 });
  }
}
