export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const { notes } = body;

    if (typeof notes !== 'string') {
      return NextResponse.json({ error: 'notes must be a string' }, { status: 400 });
    }

    const visit = await prisma.visitRecord.findUnique({
      where: { id },
      select: { initiatorUserId: true, recipientUserId: true },
    });

    if (!visit) {
      return NextResponse.json({ error: 'Visit not found' }, { status: 404 });
    }

    const isInitiator = visit.initiatorUserId === session.user.id;
    const isRecipient = visit.recipientUserId === session.user.id;

    if (!isInitiator && !isRecipient) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const updated = await prisma.visitRecord.update({
      where: { id },
      data: isInitiator
        ? { initiatorNotes: notes }
        : { recipientNotes: notes },
    });

    return NextResponse.json({ visit: updated });
  } catch (error) {
    console.error('[visits/[id]/notes] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
