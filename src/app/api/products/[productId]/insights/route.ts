// @idor-allow: public-read reason="Only approved highlights from published interviews on published projects are public."
// @idor-allow: IDOR003 reason="Public lookup by product id for product detail page"
// @idor-allow: IDOR004 reason="Read-only public insights; no mutations"
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { PUBLISHED_PROJECT_FILTER } from '@/server/queries/filters';
export async function GET(request: NextRequest, { params }: { params: { productId: string } }) {
  const requested = Number(request.nextUrl.searchParams.get('limit') || 10);
  const limit = Number.isFinite(requested) ? Math.max(1, Math.min(Math.floor(requested), 50)) : 10;
  const highlights = await prisma.quoteHighlight.findMany({
    where: { productId: params.productId, useCase: 'PRODUCT_PAGE_INSIGHT', approvedByDesigner: true,
      InterviewSession: { status: 'PUBLISHED', productId: params.productId, projects: { OR: [...PUBLISHED_PROJECT_FILTER.OR] } } },
    orderBy: { score: 'desc' }, take: limit,
    select: { id: true, quoteText: true, startMs: true, endMs: true,
      InterviewSession: { select: { id: true, recordedAt: true, projects: { select: { id: true, title: true, post: { select: { slug: true } } } }, users: { select: { id: true, name: true, profileImage: true } } } } },
  });
  const insights = highlights.map(h => ({
    id: h.id, quoteText: h.quoteText, startMs: h.startMs, endMs: h.endMs,
    designer: h.InterviewSession.users,
    project: { id: h.InterviewSession.projects!.id, title: h.InterviewSession.projects!.title, slug: h.InterviewSession.projects!.post?.slug ?? null },
    interviewSession: { id: h.InterviewSession.id, recordedAt: h.InterviewSession.recordedAt },
  }));
  return NextResponse.json({ ok: true, insights, totalCount: insights.length });
}

