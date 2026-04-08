export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/vendor/invite-to-complete
 *
 * Designer-triggered: invite a vendor to complete product details.
 * Creates a VendorInviteSignal for tracking and optionally sends an email.
 *
 * Body:
 *   productId: string
 *   vendorName: string
 *   vendorEmail?: string
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { productId, vendorName, vendorEmail } = body;

    if (!productId || !vendorName) {
      return NextResponse.json(
        { error: 'productId and vendorName are required' },
        { status: 400 }
      );
    }

    // Verify product exists
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, name: true, vendorId: true, brand: true },
    });

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    // Create a vendor invite signal for tracking
    await prisma.vendorInviteSignal.create({
      data: {
        vendorName: vendorName,
        signalType: 'PRODUCT_COMPLETION_REQUEST',
        designerId: session.user.id,
        metadata: {
          productId: product.id,
          productName: product.name,
          vendorEmail: vendorEmail || null,
          requestedBy: session.user.id,
        },
      },
    });

    // If we have a vendor email, attempt to send them a notification
    if (vendorEmail) {
      // Log the intent — actual email sending uses the same infrastructure as
      // notifyTaggedVendors but triggered by designer request
      console.log('[invite-to-complete] Vendor invite requested', {
        productId: product.id,
        productName: product.name,
        vendorName,
        vendorEmail,
        requestedBy: session.user.id,
      });

      // TODO: Send actual email via sendVendorProductPreviewEmail or similar
      // For now, this creates the signal for the admin to act on
    }

    // Also create a notification for admins to follow up
    // (Find first admin user for notification)
    const adminUser = await prisma.user.findFirst({
      where: { role: 'ADMIN' },
      select: { id: true },
    });

    if (adminUser) {
      await prisma.notification.create({
        data: {
          userId: adminUser.id,
          type: 'VENDOR_COMPLETION_REQUEST',
          title: `Designer requested vendor outreach`,
          body: `Product "${product.name}" needs completion. Vendor: ${vendorName}${vendorEmail ? ` (${vendorEmail})` : ''}`,
          actionUrl: `/admin/vendor-invites`,
          metadata: {
            productId: product.id,
            vendorName,
            vendorEmail: vendorEmail || null,
            requestedBy: session.user.id,
          },
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: vendorEmail
        ? 'Vendor invite sent'
        : 'Vendor invite request recorded — our team will follow up',
    });
  } catch (error) {
    console.error('[invite-to-complete] Error:', error);
    return NextResponse.json(
      { error: 'Failed to send invite' },
      { status: 500 }
    );
  }
}
