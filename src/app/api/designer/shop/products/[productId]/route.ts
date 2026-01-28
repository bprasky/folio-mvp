export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { syncSingleTestimonial } from '@/lib/syncTestimonials';

const UpdateSchema = z.object({
  quote: z.string().max(500).nullable().optional(),
  isFeatured: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

/**
 * PATCH /api/designer/shop/products/[productId]
 * Update a shop product
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { productId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const resolvedParams = params instanceof Promise ? await params : params;
    const shopProductId = resolvedParams.productId;

    // Verify ownership
    const shopProduct = await prisma.shopProduct.findUnique({
      where: { id: shopProductId },
      select: { designerId: true },
    });

    if (!shopProduct) {
      return NextResponse.json({ error: 'Shop product not found' }, { status: 404 });
    }

    if (shopProduct.designerId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const input = UpdateSchema.parse(body);

    const updateData: {
      quote?: string | null;
      quoteApprovedAt?: Date | null;
      isFeatured?: boolean;
      isActive?: boolean;
    } = {};

    if (input.quote !== undefined) {
      updateData.quote = input.quote;
      updateData.quoteApprovedAt = input.quote ? new Date() : null;
    }
    if (input.isFeatured !== undefined) {
      updateData.isFeatured = input.isFeatured;
    }
    if (input.isActive !== undefined) {
      updateData.isActive = input.isActive;
    }

    const updated = await prisma.shopProduct.update({
      where: { id: shopProductId },
      data: updateData,
    });

    // Sync testimonial if quote or isActive changed
    if (input.quote !== undefined || input.isActive !== undefined) {
      await syncSingleTestimonial(shopProductId);
    }

    return NextResponse.json({ success: true, shopProduct: updated });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Invalid request body', details: error.errors },
        { status: 400 }
      );
    }

    console.error('[designer/shop/products] PATCH error:', error);
    return NextResponse.json(
      { error: 'Failed to update shop product' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/designer/shop/products/[productId]
 * Remove a product from shop (soft delete by setting isActive = false)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { productId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const resolvedParams = params instanceof Promise ? await params : params;
    const shopProductId = resolvedParams.productId;

    // Verify ownership
    const shopProduct = await prisma.shopProduct.findUnique({
      where: { id: shopProductId },
      select: { designerId: true },
    });

    if (!shopProduct) {
      return NextResponse.json({ error: 'Shop product not found' }, { status: 404 });
    }

    if (shopProduct.designerId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Soft delete by setting isActive = false
    await prisma.shopProduct.update({
      where: { id: shopProductId },
      data: { isActive: false },
    });

    // Sync testimonial (will delete it since product is now inactive)
    await syncSingleTestimonial(shopProductId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[designer/shop/products] DELETE error:', error);
    return NextResponse.json(
      { error: 'Failed to remove shop product' },
      { status: 500 }
    );
  }
}
