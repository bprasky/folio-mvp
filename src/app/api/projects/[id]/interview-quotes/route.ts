export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { assertProjectView } from '@/lib/authz/access';
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try { await assertProjectView(session.user.id, params.id); }
  catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }); }
  const requested = Number(request.nextUrl.searchParams.get('limit') || 10);
  const limit = Number.isFinite(requested) ? Math.max(1, Math.min(Math.floor(requested), 50)) : 10;
  const highlights = await prisma.quoteHighlight.findMany({
    where: { approvedByDesigner: true, useCase: 'EDITORIAL_PULLQUOTE', InterviewSession: { projectId: params.id, status: 'PUBLISHED' } },
    orderBy: { score: 'desc' }, take: limit,
    select: { id: true, quoteText: true, startMs: true, endMs: true,
      InterviewSession: { select: { id: true, recordedAt: true, users: { select: { id: true, name: true, profileImage: true } } } } },
  });
  const quotes = highlights.map(h => ({ id: h.id, quoteText: h.quoteText, startMs: h.startMs, endMs: h.endMs,
    designer: h.InterviewSession.users, interviewSession: { id: h.InterviewSession.id, recordedAt: h.InterviewSession.recordedAt } }));
  return NextResponse.json({ ok: true, quotes, totalCount: quotes.length });
}
