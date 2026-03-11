export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const RequestSchema = z.object({
  folioBio: z.string().min(1).max(5000),
});

/**
 * PATCH /api/designer/bio/save
 * Save designer edits to their bio text.
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request', details: parsed.error.format() }, { status: 400 });
    }

    const userId = session.user.id;

    await prisma.designerBio.update({
      where: { userId },
      data: {
        folioBio: parsed.data.folioBio,
        bioEditedByUser: true,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[PATCH /api/designer/bio/save] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
