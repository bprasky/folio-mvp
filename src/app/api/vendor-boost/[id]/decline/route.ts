export const dynamic = 'force-dynamic';
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
  const now = new Date();
  const result = await prisma.vendorBoostRequest.updateMany({ where: { id: boost.id, requestedDesignerId: session.user.id, status: 'PENDING', updatedAt: boost.updatedAt }, data: { status: 'DECLINED', declinedAt: now, updatedAt: now } });
  if (result.count !== 1) return NextResponse.json({ error: 'Request cannot be declined' }, { status: 409 });
  return NextResponse.json({ ok: true, vendorBoostRequest: { id: boost.id, status: 'DECLINED', declinedAt: now } });
}

