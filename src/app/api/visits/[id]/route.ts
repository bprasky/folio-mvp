export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const visit = await prisma.visitRecord.findUnique({
      where: { id },
      include: {
        initiatorUser: {
          select: {
            id: true, name: true, profileImage: true, role: true,
            title: true, phone: true, email: true, location: true,
          },
        },
        recipientUser: {
          select: {
            id: true, name: true, profileImage: true, role: true,
            title: true, phone: true, email: true, location: true,
          },
        },
        initiatorOrg: { select: { id: true, name: true, type: true, logo: true } },
        recipientOrg: { select: { id: true, name: true, type: true, logo: true } },
        event: { select: { id: true, title: true, location: true, startDate: true } },
        productShares: {
          include: {
            product: {
              select: {
                id: true, name: true, imageUrl: true, category: true,
                brand: true, price: true, url: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!visit) {
      return NextResponse.json({ error: 'Visit not found' }, { status: 404 });
    }

    // Auth: only participants can view
    if (visit.initiatorUserId !== session.user.id && visit.recipientUserId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({ visit });
  } catch (error) {
    console.error('[visits/[id]] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
