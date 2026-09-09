export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { backedByTranscript } from '@/lib/interviews/provenance';

export async function POST(_request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const interview = await prisma.interviewSession.findUnique({ where: { id: params.id } });
  if (!interview) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (interview.createdByUserId !== session.user.id || session.user.role !== 'DESIGNER') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (interview.status !== 'READY' || !interview.recordingAssetId) return NextResponse.json({ error: 'Interview is not ready' }, { status: 409 });
  try {
    const now = new Date();
    await prisma.$transaction(async tx => {
      const moved = await tx.interviewSession.updateMany({ where: { id: interview.id, createdByUserId: session.user.id, status: 'READY', updatedAt: interview.updatedAt }, data: { status: 'PUBLISHED', publishedAt: now, updatedAt: now } });
      if (moved.count !== 1) throw new Error('Interview changed');
      const highlights = await tx.quoteHighlight.findMany({ where: { interviewSessionId: interview.id, approvedByDesigner: true } });
      const segments = await tx.transcriptSegment.findMany({ where: { interviewSessionId: interview.id }, orderBy: { order: 'asc' } });
      if (!highlights.length || highlights.some(h => h.productId !== interview.productId || !backedByTranscript(h, segments))) throw new Error('No valid approved quotes');
      if (interview.vendorBoostRequestId) {
        const completed = await tx.vendorBoostRequest.updateMany({ where: { id: interview.vendorBoostRequestId, interviewSessionId: interview.id, requestedDesignerId: session.user.id, vendorId: interview.vendorId!, productId: interview.productId!, projectId: interview.projectId!, status: 'ACCEPTED' }, data: { status: 'COMPLETED', completedAt: now, updatedAt: now } });
        if (completed.count !== 1) throw new Error('Boost context changed');
      }
    });
    return NextResponse.json({ ok: true, interviewSession: { id: interview.id, status: 'PUBLISHED', publishedAt: now } });
  } catch { return NextResponse.json({ error: 'Interview cannot be published. Refresh and review quotes.' }, { status: 409 }); }
}

