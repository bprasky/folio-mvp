export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import { prisma } from "@/lib/prisma";
import { assertProjectWrite } from "@/lib/authz/access";
import { generateProductCrop } from "@/lib/crops/generateProductCrop";
import { uploadCrop } from "@/lib/crops/uploadCrop";
import { getCategoryDefaultScale } from "@/lib/crops/categoryDefaults";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tagId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { tagId } = await params;

    // Parse optional manual crop adjustments
    let body: {
      cropX?: number;
      cropY?: number;
      cropScale?: number;
      cropAspect?: string;
    } = {};
    try {
      body = await request.json();
    } catch {
      // No body is fine — use defaults
    }

    // Fetch the tag with its image and product
    const tag = await prisma.productTag.findUnique({
      where: { id: tagId },
      include: {
        image: {
          select: { id: true, url: true, projectId: true },
        },
        product: {
          select: { id: true, category: true },
        },
      },
    });

    if (!tag) {
      return NextResponse.json({ error: "Tag not found" }, { status: 404 });
    }

    // Auth check
    try {
      await assertProjectWrite(session.user.id, tag.image.projectId);
    } catch {
      return NextResponse.json(
        { error: "Not authorized to modify this tag" },
        { status: 403 }
      );
    }

    const isManual = body.cropX != null || body.cropY != null || body.cropScale != null || body.cropAspect != null;

    // Generate the crop
    const cropResult = await generateProductCrop({
      tag: {
        x: tag.x,
        y: tag.y,
        cropX: body.cropX ?? tag.cropX,
        cropY: body.cropY ?? tag.cropY,
        cropScale: body.cropScale ?? tag.cropScale,
        cropAspect: body.cropAspect ?? tag.cropAspect,
        category: tag.product.category,
      },
      sourceImageUrl: tag.image.url, projectId: tag.image.projectId,
    });

    // Update tag with crop metadata
    const finalCropX = body.cropX ?? tag.cropX ?? tag.x;
    const finalCropY = body.cropY ?? tag.cropY ?? tag.y;
    const finalCropScale = body.cropScale ?? tag.cropScale ?? getCategoryDefaultScale(tag.product.category);
    const finalCropAspect = body.cropAspect ?? tag.cropAspect ?? "1:1";

    const uploadResult = await uploadCrop({
      buffer: cropResult.buffer, tagId: tag.id, projectId: tag.image.projectId,
      expected: { imageId: tag.imageId, x: tag.x, y: tag.y, updatedAt: tag.updatedAt },
      metadata: { cropX: finalCropX, cropY: finalCropY, cropScale: finalCropScale, cropAspect: finalCropAspect, cropManual: isManual },
    });

    return NextResponse.json({
      cropUrl: uploadResult.publicUrl,
      cropX: finalCropX,
      cropY: finalCropY,
      cropScale: finalCropScale,
      cropAspect: finalCropAspect,
    });
  } catch (error) {
    if (error instanceof Error && 'status' in error && error.status === 409) return NextResponse.json({ error: error.message }, { status: 409 });
    console.error("[crop] Failed to generate crop:", error);
    return NextResponse.json(
      { error: "Failed to generate crop" },
      { status: 500 }
    );
  }
}
