export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const interview = await prisma.interviewSession.findUnique({ where: { id: params.id }, select: { id: true, createdByUserId: true, status: true, errorMessage: true } });
  if (!interview) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (interview.createdByUserId !== session.user.id || session.user.role !== 'DESIGNER') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  return NextResponse.json({ ok: true, interviewSession: { id: interview.id, status: interview.status, errorMessage: interview.errorMessage } }, { headers: { 'Cache-Control': 'private, no-store' } });
}

