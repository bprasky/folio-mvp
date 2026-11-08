import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { loadPrivateProjectDigest } from '@/lib/project-memory/source-adapters';
import { suggestProjectStories } from '@/lib/project-memory/opportunities';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const digest = await loadPrivateProjectDigest(session.user.id, params.id);
    return NextResponse.json({
      projectId: digest.projectId,
      sourceDigest: digest.sourceDigest,
      suggestions: suggestProjectStories(digest),
      limitations: digest.limitations,
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    if (error instanceof Error && (error.message.startsWith('Forbidden') || error.message === 'NotFound')) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    console.error('[project-memory] story opportunity discovery failed', { projectId: params.id, error });
    return NextResponse.json({ error: 'Story suggestions are temporarily unavailable' }, { status: 500 });
  }
}
