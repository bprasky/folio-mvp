export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { backedByTranscript } from '@/lib/interviews/provenance';
import { z } from 'zod';
const schema = z.object({ highlightIds: z.array(z.string()).min(1).max(100), rejectIds: z.array(z.string()).max(100).default([]) });
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const interview = await prisma.interviewSession.findUnique({ where: { id: params.id } });
  if (!interview) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (interview.createdByUserId !== session.user.id || session.user.role !== 'DESIGNER') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (!['EXTRACTED','READY'].includes(interview.status)) return NextResponse.json({ error: 'Cannot approve in this state' }, { status: 409 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid selection' }, { status: 400 });
  const { highlightIds, rejectIds } = parsed.data;
  const ids = [...highlightIds, ...rejectIds];
  if (new Set(ids).size !== ids.length) return NextResponse.json({ error: 'Selections must be distinct' }, { status: 400 });
  try {
    await prisma.$transaction(async tx => {
      const now = new Date(Math.max(Date.now(), interview.updatedAt.getTime() + 1));
      const moved = await tx.interviewSession.updateMany({ where: { id: interview.id, createdByUserId: session.user.id, status: interview.status, updatedAt: interview.updatedAt }, data: { status: 'READY', updatedAt: now } });
      if (moved.count !== 1) throw new Error('Interview changed');
      const highlights = await tx.quoteHighlight.findMany({ where: { interviewSessionId: interview.id, id: { in: ids } } });
      const segments = await tx.transcriptSegment.findMany({ where: { interviewSessionId: interview.id }, orderBy: { order: 'asc' } });
      if (highlights.length !== ids.length || highlights.filter(h => highlightIds.includes(h.id)).some(h => !backedByTranscript(h, segments))) throw new Error('Invalid quote selection');
      // The submitted selection is authoritative, including deselected previous approvals.
      await tx.quoteHighlight.updateMany({ where: { interviewSessionId: interview.id }, data: { approvedByDesigner: false, approvedAt: null, updatedAt: now } });
      const approved = await tx.quoteHighlight.updateMany({ where: { interviewSessionId: interview.id, id: { in: highlightIds } }, data: { approvedByDesigner: true, approvedAt: now, updatedAt: now } });
      if (approved.count !== highlightIds.length) throw new Error('Quote selection changed');
      await tx.quoteHighlight.deleteMany({ where: { interviewSessionId: interview.id, id: { in: rejectIds } } });
    });
    return NextResponse.json({ ok: true, approvedCount: highlightIds.length, rejectedCount: rejectIds.length, interviewSession: { id: interview.id, status: 'READY' } });
  } catch { return NextResponse.json({ error: 'Interview or quote selection changed. Refresh before retrying.' }, { status: 409 }); }
}

