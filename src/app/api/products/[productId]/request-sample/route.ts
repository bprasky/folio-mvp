export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { resolveVendorRep } from '@/lib/messaging/rep-resolution';
import { logSignal } from '@/lib/telemetry/context-signal';

/**
 * POST /api/products/[productId]/request-sample
 *
 * Resolves the designer's vendor rep for this product's brand, sends
 * a sample request, and logs a ContextSignal crediting the tagging designer.
 *
 * Returns:
 *   { status: 'SENT', repName? } — request sent to rep
 *   { status: 'NO_REP', vendorOrgName? } — no rep found, prompt designer
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: { productId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const designerUserId = session.user.id;
  const productId = params.productId;

  // Fetch product with vendor info
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: {
      name: true,
      brand: true,
      vendorId: true,
      vendor: { select: { name: true, email: true, companyName: true } },
    },
  });

  if (!product) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 });
  }

  // Resolve vendor rep for THIS designer (not the tagging designer)
  const repResult = await resolveVendorRep(designerUserId, productId);

  // Find the tagging designer for influence attribution
  let taggingDesignerId: string | undefined;
  try {
    const tag = await prisma.productTag.findFirst({
      where: { productId },
      select: {
        image: {
          select: {
            project: {
              select: { designerId: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' }, // First tagger gets credit
    });
    taggingDesignerId = tag?.image?.project?.designerId || undefined;
  } catch {
    // Non-fatal — just won't have attribution
  }

  // Log ContextSignal for influence graph
  try {
    await logSignal({
      userId: designerUserId,
      action: 'feature_click',
      productId,
      meta: {
        action: 'request_sample',
        taggingDesignerId,
        requestingDesignerId: designerUserId,
        repStatus: repResult.status,
        repUserId: repResult.rep?.userId,
        vendorOrgName: repResult.vendorOrgName,
      },
    });
  } catch {
    // Non-fatal
  }

  // Handle based on rep resolution
  if (repResult.status === 'DIRECT_REP' && repResult.rep) {
    // Send notification to the rep (in-app)
    try {
      await prisma.notification.create({
        data: {
          userId: repResult.rep.userId,
          type: 'SAMPLE_REQUEST',
          title: 'Sample Request',
          body: `${session.user.name || 'A designer'} requested a sample of ${product.name}`,
          metadata: {
            productId,
            productName: product.name,
            requestingDesignerId: designerUserId,
            requestingDesignerName: session.user.name,
          },
        },
      });
    } catch {
      // Non-fatal — notification delivery shouldn't block the response
    }

    return NextResponse.json({
      status: 'SENT',
      repName: repResult.rep.name,
      vendorOrgName: repResult.vendorOrgName,
    });
  }

  if (repResult.status === 'ORG_MEMBERS' && repResult.orgMembers?.length) {
    // Notify the first org member
    const primaryRep = repResult.orgMembers[0];
    try {
      await prisma.notification.create({
        data: {
          userId: primaryRep.userId,
          type: 'SAMPLE_REQUEST',
          title: 'Sample Request',
          body: `${session.user.name || 'A designer'} requested a sample of ${product.name}`,
          metadata: {
            productId,
            productName: product.name,
            requestingDesignerId: designerUserId,
            requestingDesignerName: session.user.name,
          },
        },
      });
    } catch {
      // Non-fatal
    }

    return NextResponse.json({
      status: 'SENT',
      repName: primaryRep.name,
      vendorOrgName: repResult.vendorOrgName,
    });
  }

  // NO_REP — tell frontend to prompt designer to add their rep
  return NextResponse.json({
    status: 'NO_REP',
    vendorOrgName: repResult.vendorOrgName || product.brand || undefined,
  });
}
