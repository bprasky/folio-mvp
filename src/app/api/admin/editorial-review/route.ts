export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/requireAdmin';
import { prisma } from '@/lib/prisma';
import { jsonObject } from '@/lib/editorial/lifecycle';
import { z } from 'zod';
import { Prisma } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    const reviewer = await requireAdmin();
    if (!reviewer.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = await prisma.user.findUnique({ where: { id: reviewer.id }, select: { role: true } });
    if (user?.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const status = z.enum(['REVIEW', 'PUBLISHED', 'DRAFT']).safeParse(request.nextUrl.searchParams.get('status') ?? 'REVIEW');
    if (!status.success) return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    const posts = await prisma.projectPost.findMany({
      where: { status: status.data, provenance: { path: ['editorialReview', 'submittedAt'], not: Prisma.AnyNull } },
      orderBy: { updatedAt: 'desc' }, take: 100,
      select: { id: true, projectId: true, slug: true, status: true, updatedAt: true, provenance: true,
        project: { select: { title: true, designer: { select: { name: true } } } } },
    });
    return NextResponse.json({ posts: posts.map(({ provenance, ...post }) => ({
      ...post, review: jsonObject(jsonObject(provenance).editorialReview),
    })) });
  } catch (error: any) {
    const status = error.status ?? 500;
    return NextResponse.json({ error: status === 500 ? 'Unable to load editorial review' : error.message }, { status });
  }
}
