export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { initiateEditorial } from '@/lib/editorial/lifecycle';

export async function POST(_request: NextRequest, { params }: { params: { projectId: string } }) {
  const enabled = (process.env.POSTING_V1 ?? '').toLowerCase() === 'true' ||
    (process.env.NEXT_PUBLIC_POSTING_V1 ?? '').toLowerCase() === 'true' || process.env.NODE_ENV !== 'production';
  if (!enabled) return NextResponse.json({ error: 'Posting V1 not enabled' }, { status: 404 });
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const post = await initiateEditorial(session.user.id, params.projectId);
    return NextResponse.json({ ok: true, post });
  } catch (error: any) {
    const status = error.status ?? (error.message === 'Forbidden' ? 403 : error.message === 'NotFound' ? 404 : 500);
    return NextResponse.json({ error: status === 500 ? 'Internal server error' : error.message }, { status });
  }
}
