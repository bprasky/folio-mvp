import { publicProduct } from '@/lib/post/publicPost';
import { PUBLISHED_PROJECT_FILTER } from '@/server/queries/filters';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { assertProjectView, assertProjectWrite } from '@/lib/authz/access';
const coordinate = z.number().finite().min(0).max(100);
const tagInput = z.object({
  projectId: z.string().min(1), imageId: z.string().min(1), productId: z.string().min(1),
  x: coordinate, y: coordinate, createSelection: z.boolean().optional(),
  finishRaw: z.string().max(1000).nullable().optional(), finishConfirmed: z.boolean().optional(),
});
const tagPatch = z.object({
  id: z.string().min(1), x: coordinate.optional(), y: coordinate.optional(),
  reviewed: z.boolean().optional(), imageId: z.string().min(1).optional(),
  expected: z.object({ imageId: z.string().min(1), x: coordinate, y: coordinate }).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { x, y, productId, projectId, imageId, createSelection, finishRaw, finishConfirmed } =
      tagInput.parse(await request.json());

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

    const { tag, linkedSelectionId } = await prisma.$transaction(async tx => {
      // Serialize retries and selection backfill across all photos in this
      // project; two photos can otherwise claim the same unlinked selection.
      await tx.$queryRaw`SELECT id FROM projects WHERE id = ${projectId} FOR UPDATE`;
      const existing = await tx.productTag.findFirst({ where: {
        imageId, productId, x, y, finishRaw: trimmedFinish,
        finishConfirmed: trimmedFinish ? finishConfirmed === true : false,
      } });
      const tag = existing || await tx.productTag.create({
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
      await tx.projectImage.update({
        where: { id: imageId },
        data: { noProducts: false },
      });

      // Backfill: link an existing Selection to this tag (or create one)
      let linkedSelectionId: string | null = null;
      if (!existing) {
        if (image.room) {
          const room = await tx.room.findFirst({
            where: {
              projectId,
              name: { equals: image.room, mode: 'insensitive' },
            },
          });

          if (room) {
            // Find an unlinked selection that matches this product
            const orConditions: any[] = [];
            if (product.url) {
              orConditions.push({ cachedProductLinks: { some: { cachedProduct: { url: product.url } } } });
            }
            if (product.name) {
              orConditions.push({ productName: { contains: product.name, mode: 'insensitive' } });
            }

            const matchingSelection = orConditions.length > 0
              ? await tx.selection.findFirst({
                  where: {
                    roomId: room.id,
                    productTagId: null,
                    OR: orConditions,
                  },
                })
              : null;

            if (matchingSelection) {
              await tx.selection.update({
                where: { id: matchingSelection.id },
                data: { productTagId: tag.id },
              });
              linkedSelectionId = matchingSelection.id;
              console.log('[ProductTag] Backfill linked selection:', { selectionId: matchingSelection.id, tagId: tag.id });
            } else if (createSelection) {
              // Optionally create a new Selection for this product
              const newSel = await tx.selection.create({
                data: {
                  projectId,
                  roomId: room.id,
                  productName: product.name,
                  vendorName: product.brand ?? null,
                  productTagId: tag.id,
                  source: 'auto_tag',
                },
              });
              linkedSelectionId = newSel.id;
              console.log('[ProductTag] Backfill created selection:', { selectionId: newSel.id, tagId: tag.id });
            }
          }
        }
      } else {
        linkedSelectionId = (await tx.selection.findFirst({ where: { productTagId: tag.id }, select: { id: true } }))?.id ?? null;
      }

      return { tag, linkedSelectionId };
    });

    return NextResponse.json({ success: true, id: tag.id, tag, linkedSelectionId, shopProduct: null, incompleteProduct: null, inContextBoost: null });


  } catch (error) {
    if (error instanceof z.ZodError || error instanceof SyntaxError) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
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

    const session = await getServerSession(authOptions);
    let privateAccess = false;
    let scope = projectId;
    if (imageId) {
      const image = await prisma.projectImage.findUnique({ where: { id: imageId }, select: { projectId: true } });
      if (!image || (projectId && projectId !== image.projectId)) {
        return NextResponse.json([], { headers: { 'Cache-Control': 'private, no-store' } });
      }
      scope = image.projectId;
    }
    if (scope && session?.user?.id) {
      try { await assertProjectView(session.user.id, scope); privateAccess = true; }
      catch (error) {
        if (!(error instanceof Error) || error.message !== 'Forbidden') throw error;
        // Canonical writers also include firm contributors and global admins.
        try { await assertProjectWrite(session.user.id, scope); privateAccess = true; }
        catch (writeError) {
          if (!(writeError instanceof Error) || !['Forbidden', 'NotFound'].includes(writeError.message)) throw writeError;
        }
      }
    }
    // Public enumeration remains supported, but never includes private projects.
    const whereClause = {
      ...(imageId ? { imageId } : {}),
      image: { ...(scope ? { projectId: scope } : {}), ...(privateAccess ? {} : { inclusion: 'INCLUDED' as const, project: PUBLISHED_PROJECT_FILTER }) },
      ...(privateAccess ? {} : { product: { isPending: false } }),
    };

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

    return NextResponse.json(privateAccess ? tags : tags.map(tag => ({
      id: tag.id, imageId: tag.imageId, productId: tag.productId, x: tag.x, y: tag.y,
      cropUrl: tag.cropUrl, finishRaw: tag.finishRaw, product: publicProduct(tag.product),
      image: { url: tag.image.url, projectId: tag.image.projectId },
    })), { headers: { 'Cache-Control': 'private, no-store' } });

  } catch (error) {
    if (error instanceof z.ZodError || error instanceof SyntaxError) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
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
    if (error instanceof z.ZodError || error instanceof SyntaxError) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
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

    const { id, x, y, reviewed, imageId: targetImageId, expected } = tagPatch.parse(await request.json());

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

    if (!isReviewMode && !expected) return NextResponse.json({
      error: 'This editor needs the saved tag position. Refresh the project before moving the tag.',
    }, { status: 428 });

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

    const updated = await prisma.$transaction(async tx => {
      // Share the project lock with tag creation and photo room assignment.
      await tx.$queryRaw`SELECT id FROM projects WHERE id = ${tag.image.projectId} FOR UPDATE`;
      const current = await tx.productTag.findUniqueOrThrow({ where: { id } });
      if (expected) {
        const alreadySaved = Object.entries(data).every(([key, value]) => key === 'reviewedAt' ? !!current.reviewedAt : current[key as 'x' | 'y' | 'imageId'] === value);
        if (!alreadySaved) {
          const changed = await tx.productTag.updateMany({ where: { id, imageId: expected.imageId, x: expected.x, y: expected.y },
            data: { ...data, ...(!isReviewMode ? { cropUrl: null, cropX: null, cropY: null, cropScale: null, cropAspect: null, cropManual: false } : {}) } });
          if (changed.count !== 1) throw Object.assign(new Error('This tag changed in another edit. Refresh the project, then try again.'), { status: 409 });
        }
      } else await tx.productTag.update({ where: { id }, data }); // review-only acknowledgement
      if (isMoveMode && !isReviewMode) {
        const target = await tx.projectImage.update({ where: { id: targetImageId, projectId: tag.image.projectId }, data: { noProducts: false } });
        await tx.selection.updateMany({ where: { productTagId: id, projectId: tag.image.projectId },
          data: { roomId: target.roomId ?? null, photo: target.url } });
      }
      return tx.productTag.findUniqueOrThrow({ where: { id } });
    });

    return NextResponse.json(updated);

  } catch (error) {
    if (error instanceof Error && 'status' in error && error.status === 409) return NextResponse.json({ error: error.message }, { status: 409 });
    if (error instanceof z.ZodError || error instanceof SyntaxError) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    console.error('Failed to update product tag:', error);
    return NextResponse.json(
      { error: 'Failed to update product tag' },
      { status: 500 }
    );
  }
}
