/**
 * POST /api/import/pending-tag/[tagId]/place
 *
 * Place a finish-schedule product (a spec PendingProductTag) onto a specific
 * project photo at the given coordinates: create/find the Product from the
 * extracted fields, create the real ProductTag, and mark the pending tag
 * CONFIRMED with resultingTagId. This is the finish-schedule counterpart to the
 * per-tag verify route, which can't place spec tags (they carry no suggestion
 * and no image). Body: { imageId, x, y } with x/y in 0–100 percent.
 */

export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { assertProjectWrite } from '@/lib/authz/access';
import { prisma } from '@/lib/prisma';
import { ensureProductForSelection } from '@/lib/tagging/ensureProductForSelection';
import { recordLabelEvent } from '@/lib/vision/recordLabelEvent';

export async function POST(req: NextRequest, { params }: { params: Promise<{ tagId: string }> }) {
  try {
    const { tagId } = await params;

    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string })?.id;
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { imageId, x, y } = await req.json();
    if (!imageId || x == null || y == null) {
      return NextResponse.json({ error: 'Missing imageId, x, or y' }, { status: 400 });
    }

    const pendingTag = await prisma.pendingProductTag.findUnique({
      where: { id: tagId },
      include: { importSession: true },
    });
    if (!pendingTag) {
      return NextResponse.json({ error: 'Tag not found' }, { status: 404 });
    }
    if (pendingTag.status !== 'UNREVIEWED') {
      return NextResponse.json({ error: 'Tag has already been reviewed' }, { status: 400 });
    }

    const projectId = pendingTag.importSession.projectId;
    if (!projectId) {
      return NextResponse.json({ error: 'Import session has no project' }, { status: 400 });
    }

    // Project write access (owner, designer, org member, or admin).
    try {
      await assertProjectWrite(userId, projectId);
    } catch {
      return NextResponse.json({ error: 'Not permitted' }, { status: 403 });
    }

    // The image must belong to this project.
    const image = await prisma.projectImage.findFirst({
      where: { id: imageId, projectId },
      select: { id: true },
    });
    if (!image) {
      return NextResponse.json({ error: 'Image not found in this project' }, { status: 404 });
    }

    // Create/find the Product from the extracted finish-schedule fields.
    // extractedPrice is stored in cents; Product.price is in dollars.
    const productId = await ensureProductForSelection({
      productName: pendingTag.description,
      vendorName: pendingTag.extractedVendor,
      unitPrice: pendingTag.extractedPrice != null ? pendingTag.extractedPrice / 100 : null,
      productUrl: pendingTag.extractedProductUrl,
    });
    if (!productId) {
      return NextResponse.json({ error: 'Could not create a product for this row' }, { status: 400 });
    }

    const productTag = await prisma.productTag.create({
      data: {
        // Finish is deliberately NULL here (spec 21 delta D3). A tag arriving
        // through an import has no specification event behind it, and a
        // fabricated finish is indistinguishable from an observed one once
        // stored. If this tag is later opened in the tagging UI it becomes a
        // capture site like any other. Do not "fix" this by proposing a value.
        imageId,
        productId,
        x: parseFloat(String(x)),
        y: parseFloat(String(y)),
      },
    });

    // A tagged photo cannot be "no products".
    await prisma.projectImage.update({
      where: { id: imageId },
      data: { noProducts: false },
    });

    await prisma.pendingProductTag.update({
      where: { id: tagId },
      data: {
        status: 'CONFIRMED',
        projectImageId: imageId,
        x: parseFloat(String(x)),
        y: parseFloat(String(y)),
        confirmedProductId: productId,
        resultingTagId: productTag.id,
        reviewedAt: new Date(),
      },
    });

    await prisma.importSession.update({
      where: { id: pendingTag.importSessionId },
      data: { verifiedTags: { increment: 1 } },
    });

    // Best-effort provenance signal, mirroring the verify route.
    try {
      await recordLabelEvent({
        projectId,
        imageId,
        userId,
        source: 'HUMAN',
        taskType: 'PRODUCT_TAG',
        action: 'confirm',
        value: {
          category: pendingTag.category,
          description: pendingTag.description,
          x: parseFloat(String(x)),
          y: parseFloat(String(y)),
          confirmedProductId: productId,
        },
      });
    } catch {
      /* non-fatal */
    }

    return NextResponse.json({ productTagId: productTag.id, productId });
  } catch (error) {
    console.error('[pending-tag/place] error:', error);
    return NextResponse.json({ error: 'Failed to place product' }, { status: 500 });
  }
}
