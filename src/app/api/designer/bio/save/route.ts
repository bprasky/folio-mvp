export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { canAccessDesignerTools } from '@/lib/permissions';

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

    const allowed = await prisma.$transaction(async tx => {
      const actor = await tx.user.findUnique({ where: { id: userId }, select: { role: true } });
      if (!actor || !canAccessDesignerTools(actor.role)) return false;
      const existing = await tx.designerBio.findUnique({ where: { userId } });
      if (!existing) throw new Error('No bio to edit.');
      // Preserve the last public copy when editing a bio published before profile synchronization.
      if (existing.status === 'published' && existing.folioBio) {
        await tx.user.update({ where: { id: userId }, data: { bio: existing.folioBio } });
      }
      await tx.designerBio.update({ where: { userId }, data: {
        folioBio: parsed.data.folioBio,
        bioEditedByUser: true,
        status: 'generated',
      } });
      return true;
    }, { isolationLevel: 'Serializable' });
    if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[PATCH /api/designer/bio/save] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
