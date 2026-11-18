import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { loadPrivateProjectDigest } from '@/lib/project-memory/source-adapters';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const digest = await loadPrivateProjectDigest(session.user.id, params.id);
    return NextResponse.json(digest, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    if (error instanceof Error && (error.message.startsWith('Forbidden') || error.message === 'NotFound')) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    console.error('[project-memory] private digest failed', { projectId: params.id, error });
    return NextResponse.json({ error: 'Project memory is temporarily unavailable' }, { status: 500 });
  }
}
