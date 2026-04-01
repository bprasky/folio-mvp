export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { productId, notes } = await request.json();

    if (!productId || typeof productId !== 'string') {
      return NextResponse.json({ error: 'productId is required' }, { status: 400 });
    }

    if (typeof notes !== 'string' && notes !== null) {
      return NextResponse.json({ error: 'notes must be a string or null' }, { status: 400 });
    }

    const entry = await prisma.sourcebookEntry.upsert({
      where: {
        userId_productId: {
          userId: session.user.id,
          productId,
        },
      },
      create: {
        userId: session.user.id,
        productId,
        notes,
      },
      update: {
        notes,
      },
    });

    return NextResponse.json({ entry });
  } catch (error: unknown) {
    console.error('[API] /api/designer/sourcebook/notes error:', error);
    return NextResponse.json({ error: 'Failed to update notes' }, { status: 500 });
  }
}
