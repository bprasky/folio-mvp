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
    return NextResponse.json(await getStudioData(session.user.id, projectId), {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    if (error instanceof StudioAccessError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('[publishing-studio] Failed to load workspace', error);
    return NextResponse.json({ error: 'Unable to load Publishing Studio' }, { status: 500 });
  }
}
