export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { MEDIA_TTL_SECONDS, signedMedia } from '@/lib/interviews/media';

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const interview = await prisma.interviewSession.findUnique({ where: { id: params.id }, include: { MediaAsset: true } });
  if (!interview) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (interview.createdByUserId !== session.user.id || session.user.role !== 'DESIGNER') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (!interview.MediaAsset) return NextResponse.json({ error: 'No recording' }, { status: 404 });
  try {
    return NextResponse.json({ url: await signedMedia(interview.id, interview.MediaAsset), expiresIn: MEDIA_TTL_SECONDS }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch { return NextResponse.json({ error: 'Media access unavailable' }, { status: 503 }); }
}
