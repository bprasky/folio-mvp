export const dynamic = 'force-dynamic';
import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
const schema = z.object({
  projectId: z.string().uuid().optional(), productId: z.string().uuid().optional(),
  vendorBoostRequestId: z.string().optional(), mode: z.literal('AUDIO').default('AUDIO'),
  promptLens: z.string().max(2000).optional(),
}).refine(v => v.projectId || v.productId || v.vendorBoostRequestId);
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.user.role !== 'DESIGNER') return NextResponse.json({ error: 'Designer access required' }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid interview context or recording mode' }, { status: 400 });
  const input = parsed.data;
  if (input.vendorBoostRequestId) {
    // Acceptance is the sole creator of boost sessions. Never rebuild its context from client IDs.
    const boost = await prisma.vendorBoostRequest.findUnique({ where: { id: input.vendorBoostRequestId }, include: { interviewSession: true } });
    if (!boost) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (boost.requestedDesignerId !== session.user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const existing = boost.interviewSession;
    if (boost.status !== 'ACCEPTED' || !existing || existing.createdByUserId !== session.user.id
      || existing.vendorBoostRequestId !== boost.id || existing.productId !== boost.productId || existing.projectId !== boost.projectId || existing.vendorId !== boost.vendorId
      || (input.productId && input.productId !== boost.productId) || (input.projectId && input.projectId !== boost.projectId)) {
      return NextResponse.json({ error: 'Accept the request from your inbox; its interview context cannot be overridden' }, { status: 409 });
    }
    return NextResponse.json({ ok: true, interviewSession: { id: existing.id, status: existing.status, mode: existing.mode, createdAt: existing.createdAt } });
  }
  if (input.projectId) {
    const project = await prisma.project.findUnique({ where: { id: input.projectId }, select: { ownerId: true, designerId: true } });
    if (!project || (project.ownerId !== session.user.id && project.designerId !== session.user.id)) return NextResponse.json({ error: 'Project access denied' }, { status: 403 });
  }
  if (input.productId) {
    const product = await prisma.product.findUnique({ where: { id: input.productId }, select: { id: true } });
    if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    if (input.projectId && !await prisma.productTag.findFirst({ where: { productId: input.productId, image: { projectId: input.projectId } }, select: { id: true } })) return NextResponse.json({ error: 'Product is not tagged in this project' }, { status: 400 });
  }
  try {
    const interviewSession = await prisma.interviewSession.create({ data: { id: randomUUID(), createdByUserId: session.user.id, projectId: input.projectId ?? null, productId: input.productId ?? null, mode: 'AUDIO', promptLens: input.promptLens ?? null, status: 'DRAFT', updatedAt: new Date() }, select: { id: true, status: true, mode: true, createdAt: true } });
    return NextResponse.json({ ok: true, interviewSession });
  } catch { return NextResponse.json({ error: 'Interview could not be created' }, { status: 500 }); }
}

