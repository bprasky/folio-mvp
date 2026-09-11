export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { assertProjectWrite } from '@/lib/authz/access';
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const {
      x,
      y,
      productId,
      projectId,
      imageId,
      // Optional decision capture fields
      decisionReasoning,
      alternativesConsidered,
      tradeoffs,
      convictionLevel,
      // Shop product fields
      addToShop,
      shopQuote,
      // Backfill option: create a Selection on the design board if none matches
      createSelection,
      // Finish capture (spec 21 delta D3). This is the CAPTURE site: the designer
      // is looking at the product as they tag it, so extraction proposes and the
      // designer confirms. `finishConfirmed` records whether a human actually
      // stated this finish — it is the only thing separating an observed finish
      // from a suggested one, and Material Study depends on that distinction.
      finishRaw,
      finishConfirmed,
    } = await request.json();

    // Validate required fields
    if (x == null || y == null || !productId || !imageId) {
      return NextResponse.json(
        { error: 'Missing required fields: x, y, productId, imageId' },
        { status: 400 }
      );
    }

    // Check project write access (owner, designer, org member, or admin)
    try {
      await assertProjectWrite(session.user.id, projectId);
    } catch (e: any) {
      return NextResponse.json(
        { error: 'Project not found or not permitted' },
        { status: 403 }
      );
    }

    // Fetch project for designerId
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        designerId: true,
        ownerId: true
      },
    });

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // Verify image belongs to project
    const image = await prisma.projectImage.findFirst({
      where: {
        id: imageId,
        projectId: projectId
      },
      select: { id: true, room: true },
    });

    if (!image) {
      return NextResponse.json(
        { error: 'Image not found or does not belong to project' },
        { status: 404 }
      );
    }

    // Get product details for signal recording + completeness check
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        name: true,
        vendorId: true,
        category: true,
        url: true,
        brand: true,
        imageUrl: true,
      }
    });

    if (!product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }

    // Determine designerId (prefer project designerId, fallback to ownerId if user is owner)
    const designerId = project.designerId || 
                      (project.ownerId === session.user.id ? session.user.id : null);

    // Create product tag in database
    const trimmedFinish =
      typeof finishRaw === 'string' && finishRaw.trim() ? finishRaw.trim() : null;

    const tag = await prisma.productTag.create({
      data: {
        x: parseFloat(String(x)),
        y: parseFloat(String(y)),
        productId,
        imageId,
        // Finish capture (spec 21 delta D3). A finish with no value is NULL
        // rather than an empty string: an empty string reads as an observed
        // absence, and NULL is the accurate statement that nothing was said.
        finishRaw: trimmedFinish,
        // True only when the client says a human supplied or edited this value.
        // A finish that passed through from extraction untouched stays false,
        // even though it arrived on the same request.
        finishConfirmed: trimmedFinish ? finishConfirmed === true : false,
      },
      include: {
        product: true,
      }
    });

    // A tagged photo cannot be "no products" — clearing keeps the derived
    // review gate honest if this tag is later dismissed (spec 20 §3d).
    await prisma.projectImage.update({
      where: { id: imageId },
      data: { noProducts: false },
    });

    return NextResponse.json(tag);


  } catch (error) {
    console.error('Failed to create product tag:', error);
    return NextResponse.json(
      { error: 'Failed to create product tag' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const imageId = searchParams.get('imageId');

    const whereClause: any = {};

    // Build query based on filters
    if (imageId) {
      whereClause.imageId = imageId;
    } else if (projectId) {
      whereClause.image = {
        projectId: projectId
      };
    }

    // Fetch tags from database
    const tags = await prisma.productTag.findMany({
      where: whereClause,
      include: {
        product: true,
        image: {
          select: {
            url: true,
            projectId: true,
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return NextResponse.json(tags);

  } catch (error) {
    console.error('Failed to fetch product tags:', error);
    return NextResponse.json(
      { error: 'Failed to fetch product tags' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const tagId = searchParams.get('id');

    if (!tagId) {
      return NextResponse.json(
        { error: 'Tag ID required' },
        { status: 400 }
      );
    }

    // Verify tag belongs to user's project
    const tag = await prisma.productTag.findUnique({
      where: { id: tagId },
      include: {
        image: {
          select: { projectId: true }
        }
      }
    });

    if (!tag) {
      return NextResponse.json(
        { error: 'Tag not found' },
        { status: 404 }
      );
    }

    // Check project write access via the tag's project
    try {
      await assertProjectWrite(session.user.id, tag.image.projectId);
    } catch {
      return NextResponse.json(
        { error: 'Not authorized to delete this tag' },
        { status: 403 }
      );
    }

    // Delete the tag
    await prisma.productTag.delete({
      where: { id: tagId }
    });

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Failed to delete product tag:', error);
    return NextResponse.json(
      { error: 'Failed to delete product tag' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id, x, y, reviewed, imageId: targetImageId } = await request.json();

    // Three modes: reposition (x, y), mark-reviewed (reviewed: true), or move to
    // another photo (imageId). The reviewed flag confirms a deferred-scrape tag.
    const isReviewMode = reviewed === true;
    const isMoveMode = typeof targetImageId === 'string' && !!targetImageId;
    if (!id || (!isReviewMode && !isMoveMode && (x == null || y == null))) {
      return NextResponse.json(
        { error: 'Missing required fields: id and either (x, y), imageId, or reviewed' },
        { status: 400 }
      );
    }

    // Verify tag exists and get project for authz
    const tag = await prisma.productTag.findUnique({
      where: { id },
      include: {
        image: { select: { projectId: true } }
      }
    });

    if (!tag) {
      return NextResponse.json({ error: 'Tag not found' }, { status: 404 });
    }

    try {
      await assertProjectWrite(session.user.id, tag.image.projectId);
    } catch {
      return NextResponse.json(
        { error: 'Not authorized to update this tag' },
        { status: 403 }
      );
    }

    let data: { reviewedAt: Date } | { x: number; y: number } | { imageId: string; x: number; y: number };
    if (isReviewMode) {
      data = { reviewedAt: new Date() };
    } else if (isMoveMode) {
      // Move the tag to another photo in the SAME project. Keep x/y if given
      // (else center) so the designer can drag it into place on the new photo.
      const target = await prisma.projectImage.findFirst({
        where: { id: targetImageId, projectId: tag.image.projectId },
        select: { id: true },
      });
      if (!target) {
        return NextResponse.json(
          { error: 'Target photo not found in this project' },
          { status: 404 }
        );
      }
      data = { imageId: targetImageId, x: x ?? 50, y: y ?? 50 };
    } else {
      data = { x, y };
    }

    const updated = await prisma.productTag.update({ where: { id }, data });

    return NextResponse.json(updated);

  } catch (error) {
    console.error('Failed to update product tag:', error);
    return NextResponse.json(
      { error: 'Failed to update product tag' },
      { status: 500 }
    );
  }
}