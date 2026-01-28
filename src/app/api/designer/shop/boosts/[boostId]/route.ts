export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { setTestimonialFeatured } from '@/lib/syncTestimonials';

const ActionSchema = z.object({
  action: z.enum(['approve', 'decline']),
  declineReason: z.string().max(500).optional(),
});

/**
 * PATCH /api/designer/shop/boosts/[boostId]
 * Approve or decline a boost request
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { boostId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const resolvedParams = params instanceof Promise ? await params : params;
    const boostId = resolvedParams.boostId;

    // Verify boost exists and designer owns the shop product
    const boost = await prisma.shopBoost.findUnique({
      where: { id: boostId },
      include: {
        shopProduct: {
          select: { id: true, designerId: true },
        },
      },
    });

    if (!boost) {
      return NextResponse.json({ error: 'Boost not found' }, { status: 404 });
    }

    if (boost.shopProduct.designerId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (boost.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Boost has already been processed' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const input = ActionSchema.parse(body);

    if (input.action === 'approve') {
      // Approve the boost
      const updated = await prisma.shopBoost.update({
        where: { id: boostId },
        data: {
          status: 'APPROVED',
          approvedAt: new Date(),
        },
      });

      // Credit the designer's Folio balance
      await prisma.user.update({
        where: { id: session.user.id },
        data: {
          folioCreditBalance: {
            increment: Number(boost.designerCredit),
          },
        },
      });

      // Mark the testimonial as featured
      await setTestimonialFeatured(boost.shopProduct.id, true);

      console.log('[shop/boosts] Approved boost:', {
        boostId,
        shopProductId: boost.shopProduct.id,
        designerCredit: boost.designerCredit,
      });

      return NextResponse.json({ success: true, status: 'APPROVED' });
    } else {
      // Decline the boost
      const updated = await prisma.shopBoost.update({
        where: { id: boostId },
        data: {
          status: 'DECLINED',
          declinedAt: new Date(),
          declineReason: input.declineReason,
        },
      });

      console.log('[shop/boosts] Declined boost:', { boostId });

      return NextResponse.json({ success: true, status: 'DECLINED' });
    }
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Invalid request body', details: error.errors },
        { status: 400 }
      );
    }

    console.error('[designer/shop/boosts] PATCH error:', error);
    return NextResponse.json(
      { error: 'Failed to process boost' },
      { status: 500 }
    );
  }
}
