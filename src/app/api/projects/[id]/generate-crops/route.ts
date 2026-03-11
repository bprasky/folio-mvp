export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import { prisma } from "@/lib/prisma";
import { assertProjectWrite } from "@/lib/authz/access";
import { generateProductCrop } from "@/lib/crops/generateProductCrop";
import { uploadCrop } from "@/lib/crops/uploadCrop";
import { getCategoryDefaultScale } from "@/lib/crops/categoryDefaults";

const CONCURRENCY_LIMIT = 3;

/** Process items with a concurrency pool */
async function pooledMap<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  concurrency: number
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = [];
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const i = index++;
      try {
        const value = await fn(items[i]);
        results[i] = { status: "fulfilled", value };
      } catch (reason: any) {
        results[i] = { status: "rejected", reason };
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: projectId } = await params;

    // Auth check
    try {
      await assertProjectWrite(session.user.id, projectId);
    } catch {
      return NextResponse.json(
        { error: "Not authorized for this project" },
        { status: 403 }
      );
    }

    // Check for force regeneration flag
    let force = false;
    try {
      const body = await request.json();
      force = body?.force === true;
    } catch {
      // No body is fine
    }

    // Find tags to process (all tags if force, otherwise only those without crops)
    const tags = await prisma.productTag.findMany({
      where: {
        image: { projectId },
        ...(force ? {} : { cropUrl: null }),
      },
      include: {
        image: {
          select: { id: true, url: true, projectId: true },
        },
        product: {
          select: { id: true, category: true },
        },
      },
    });

    if (tags.length === 0) {
      return NextResponse.json({ generated: 0, failed: 0, errors: [] });
    }

    const errors: string[] = [];
    let generated = 0;

    const results = await pooledMap(
      tags,
      async (tag) => {
        const cropResult = await generateProductCrop({
          tag: {
            x: tag.x,
            y: tag.y,
            cropX: tag.cropX,
            cropY: tag.cropY,
            // When force-regenerating, ignore saved cropScale (unless manually set)
            // so updated category defaults take effect
            cropScale: force && !tag.cropManual ? null : tag.cropScale,
            cropAspect: tag.cropAspect,
            category: tag.product.category,
          },
          sourceImageUrl: tag.image.url,
        });

        const uploadResult = await uploadCrop({
          buffer: cropResult.buffer,
          tagId: tag.id,
          projectId: tag.image.projectId,
        });

        // Update tag with crop metadata
        // When force-regenerating, recalculate scale from category defaults
        // (don't reuse stale cropScale from a previous generation)
        const effectiveScale = force
          ? (tag.cropManual ? tag.cropScale : null) ?? getCategoryDefaultScale(tag.product.category)
          : tag.cropScale ?? getCategoryDefaultScale(tag.product.category);

        await prisma.productTag.update({
          where: { id: tag.id },
          data: {
            cropX: tag.cropX ?? tag.x,
            cropY: tag.cropY ?? tag.y,
            cropScale: effectiveScale,
            cropAspect: tag.cropAspect ?? "1:1",
          },
        });

        return uploadResult;
      },
      CONCURRENCY_LIMIT
    );

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (result.status === "fulfilled") {
        generated++;
      } else {
        const tagId = tags[i].id;
        const msg = result.reason?.message || "Unknown error";
        errors.push(`Tag ${tagId}: ${msg}`);
        console.error(`[generate-crops] Failed for tag ${tagId}:`, result.reason);
      }
    }

    return NextResponse.json({ generated, failed: errors.length, errors });
  } catch (error) {
    console.error("[generate-crops] Failed:", error);
    return NextResponse.json(
      { error: "Failed to generate crops" },
      { status: 500 }
    );
  }
}
