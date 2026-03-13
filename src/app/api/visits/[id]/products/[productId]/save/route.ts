export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; productId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id, productId } = await params;
    const body = await req.json().catch(() => ({}));
    const { projectId } = body;

    // Verify the user is a participant
    const visit = await prisma.visitRecord.findUnique({
      where: { id },
      select: { initiatorUserId: true, recipientUserId: true },
    });

    if (!visit) {
      return NextResponse.json({ error: 'Visit not found' }, { status: 404 });
    }

    if (visit.initiatorUserId !== session.user.id && visit.recipientUserId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Find the product share record
    const productShare = await prisma.visitProductShare.findUnique({
      where: {
        visitRecordId_productId: {
          visitRecordId: id,
          productId,
        },
      },
    });

    if (!productShare) {
      return NextResponse.json({ error: 'Product not found in this visit' }, { status: 404 });
    }

    // Update saved status
    const updated = await prisma.visitProductShare.update({
      where: { id: productShare.id },
      data: {
        savedByRecipient: true,
        savedToProjectId: projectId || null,
      },
    });

    return NextResponse.json({ productShare: updated });
  } catch (error) {
    console.error('[visits/[id]/products/[productId]/save] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
