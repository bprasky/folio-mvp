export const dynamic = 'force-dynamic';
import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
export async function POST(_request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const boost = await prisma.vendorBoostRequest.findUnique({ where: { id: params.id } });
  if (!boost) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (boost.requestedDesignerId !== session.user.id || session.user.role !== 'DESIGNER') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (boost.status !== 'PENDING' || boost.interviewSessionId || (boost.expiresAt && boost.expiresAt <= new Date())) return NextResponse.json({ error: 'Request cannot be accepted' }, { status: 409 });
  try {
    const interviewSession = await prisma.$transaction(async tx => {
      const now = new Date();
      const claimed = await tx.vendorBoostRequest.updateMany({ where: { id: boost.id, requestedDesignerId: session.user.id, status: 'PENDING', interviewSessionId: null, updatedAt: boost.updatedAt, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }, data: { status: 'ACCEPTED', acceptedAt: now, updatedAt: now } });
      if (claimed.count !== 1) throw new Error('Request changed');
      const project = await tx.project.findUnique({ where: { id: boost.projectId }, select: { ownerId: true, designerId: true } });
      if (!project || (project.ownerId !== session.user.id && project.designerId !== session.user.id)) throw new Error('Project access changed');
      const created = await tx.interviewSession.create({ data: { id: randomUUID(), createdByUserId: session.user.id, projectId: boost.projectId, productId: boost.productId, vendorId: boost.vendorId, vendorBoostRequestId: boost.id, mode: 'AUDIO', status: 'DRAFT', updatedAt: now }, select: { id: true, status: true, createdAt: true } });
      await tx.vendorBoostRequest.update({ where: { id: boost.id }, data: { interviewSessionId: created.id, updatedAt: now } });
      return created;
    });
    return NextResponse.json({ ok: true, vendorBoostRequest: { id: boost.id, status: 'ACCEPTED', interviewSessionId: interviewSession.id }, interviewSession });
  } catch { return NextResponse.json({ error: 'Request changed or cannot be accepted' }, { status: 409 }); }
}

