import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { getStudioData, StudioAccessError } from '@/lib/publishing-studio/data';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const projectId = request.nextUrl.searchParams.get('projectId') || undefined;
    const data = await getStudioData(session.user.id, projectId);
    if (process.env.STUDIO_EDITORIAL_READINESS === 'true') {
      const { listReadiness } = await import('@/lib/publishing-studio/readiness/service');
      const readiness = await listReadiness(session.user.id);
      data.readinessEnabled = true;
      data.feed = [
        ...readiness.candidates.filter(candidate => !projectId || candidate.projectIds.includes(projectId)).map(candidate => ({
          id: candidate.id, candidateId: candidate.id, projectIds: candidate.projectIds, title: candidate.draft.headline,
          caption: candidate.draft.caption, imageUrl: candidate.visuals[0]?.url || null, imageUrls: candidate.visuals.map(image => image.url),
          kind: 'suggestion' as const, format: candidate.format, status: candidate.readiness, updatedAt: candidate.createdAt,
          canPolish: true, pitch: candidate.thesis, rationale: candidate.rationale, slideCount: candidate.visuals.length,
        })),
        ...data.feed.filter(card => card.kind === 'carousel' || card.kind === 'campaign'),
      ];
    }
    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    if (error instanceof StudioAccessError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('[publishing-studio] Failed to load workspace', error);
    return NextResponse.json({ error: 'Unable to load Publishing Studio' }, { status: 500 });
  }
}
