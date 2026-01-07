// src/app/api/projects/[id]/generate-2d-cutouts/route.ts
//
// Generate 2D Product Cutouts API Route
//
// Used by:
// - Magazine editorial cutout rail (EditorialProductCutoutsRail)
// - Project page admin buttons (Generate2DCutoutsButton)
//
// Generates 2D SAM cutout images for products using Roboflow SAM3.
// Products with existing cutoutImageUrl are skipped (idempotent).
// Returns detailed stats and per-product results for debugging.

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { assertProjectView } from '@/lib/authz/access';
import { prisma } from '@/lib/prisma';
import { uploadGeneratedCutout } from '@/lib/storage';
import sharp from 'sharp';

type RequestBody = {
  productIds?: string[];
  promptOverride?: string;
};

/**
 * Build intelligent prompts from product information
 * Helps SAM3 identify the correct object to segment
 */
function buildPromptsFromProduct(product: {
  name: string | null;
  vendorName?: string | null;
}): string[] {
  const rawName = (product.name ?? "").toLowerCase();

  const TYPE_KEYWORDS = [
    "sofa",
    "sectional",
    "chair",
    "stool",
    "lamp",
    "floor lamp",
    "table lamp",
    "pendant",
    "chandelier",
    "bed",
    "dining table",
    "coffee table",
    "console",
    "side table",
    "rug",
    "mirror",
    "sconce",
    "sideboard",
    "cabinet",
    "slab",
    "tile",
    "stone",
    "marble",
    "granite",
    "wood",
  ];

  let primaryType = TYPE_KEYWORDS.find((kw) => rawName.includes(kw));

  // default fallbacks if we find nothing
  if (!primaryType) {
    primaryType = "furniture";
  }

  const cleanedName = rawName
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const prompts: string[] = [];

  // Main object type prompt
  prompts.push(primaryType);

  // Slightly more specific
  if (cleanedName.length) {
    prompts.push(`${cleanedName}`);
    // "Brand + type" style prompt if vendorName exists
    if (product.vendorName) {
      const vendor = product.vendorName.toLowerCase();
      prompts.push(`${vendor} ${primaryType}`);
    }
  }

  // Deduplicate
  return Array.from(new Set(prompts)).slice(0, 3);
}

// TODO: Gate this behind premium designer tier once billing is wired.
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const projectId = params.id;
  try {
    // Read force parameter from URL
    const url = new URL(request.url);
    const force = url.searchParams.get("force") === "true";

    // Validate authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Validate project access
    const access = await assertProjectView(session.user.id, projectId);
    if (!access) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Parse request body
    const body: RequestBody = await request.json().catch(() => ({}));
    const { productIds, promptOverride } = body;

    // Fetch project to ensure it exists
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, title: true },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Find all products associated with this project
    // If force=true, we ignore existing cutouts and regenerate everything
    // Otherwise, cutoutImageUrl IS NULL is the source of truth - we skip products that already have cutouts
      let eligibleProducts: Array<{
        id: string;
        imageUrl: string;
        name: string;
        vendor?: { name: string | null; companyName: string | null } | null;
      }> = [];
    let skippedProducts: Array<{ id: string; name: string; cutoutImageUrl: string }> = [];

    if (productIds && productIds.length > 0) {
      // If specific product IDs provided, fetch those and separate by eligibility
      const products = await prisma.product.findMany({
        where: {
          id: { in: productIds },
          imageUrl: { not: null },
        },
        select: {
          id: true,
          imageUrl: true,
          name: true,
          cutoutImageUrl: true,
          vendor: {
            select: {
              id: true,
              name: true,
              companyName: true,
            },
          },
        },
      });

      // Separate eligible from skipped based on force parameter
      for (const product of products) {
        if (!product.imageUrl) continue;

        // If force=true, we ignore existing cutouts and re-run everything
        if (force) {
          eligibleProducts.push({
            id: product.id,
            imageUrl: product.imageUrl,
            name: product.name,
            vendor: product.vendor,
          });
        } else {
          // Default behavior: only generate for products that don't have cutouts yet
          if (product.cutoutImageUrl === null) {
            eligibleProducts.push({
              id: product.id,
              imageUrl: product.imageUrl,
              name: product.name,
              vendor: product.vendor,
            });
          } else {
            skippedProducts.push({
              id: product.id,
              name: product.name,
              cutoutImageUrl: product.cutoutImageUrl,
            });
          }
        }
      }
    } else {
      // Otherwise, find all products associated with the project through:
      // 1. ProductTag (products tagged on project images)
      // 2. ProjectProductTag (direct product tags on projects)
      // 3. Selection (products selected in rooms)

      // Get products from ProductTag (via ProjectImage)
      const productTags = await prisma.productTag.findMany({
        where: {
          image: {
            projectId: projectId,
          },
        },
        include: {
          product: {
            select: {
              id: true,
              imageUrl: true,
              name: true,
              cutoutImageUrl: true,
            },
          },
        },
      });

      // Get products from ProjectProductTag
      const projectProductTags = await prisma.projectProductTag.findMany({
        where: {
          projectId: projectId,
        },
        include: {
          product: {
            select: {
              id: true,
              imageUrl: true,
              name: true,
              cutoutImageUrl: true,
              vendor: {
                select: {
                  id: true,
                  name: true,
                  companyName: true,
                },
              },
            },
          },
        },
      });

      // Get products from Selections (via vendorProductId)
      const selections = await prisma.selection.findMany({
        where: {
          projectId: projectId,
          vendorProductId: { not: null },
        },
        select: {
          vendorProductId: true,
        },
      });

      const selectionProductIds = selections
        .map((s) => s.vendorProductId)
        .filter((id): id is string => id !== null);

      const selectionProducts = selectionProductIds.length > 0
        ? await prisma.product.findMany({
            where: {
              id: { in: selectionProductIds },
            },
            select: {
              id: true,
              imageUrl: true,
              name: true,
              cutoutImageUrl: true,
              vendor: {
                select: {
                  id: true,
                  name: true,
                  companyName: true,
                },
              },
            },
          })
        : [];

      // Combine all products and deduplicate
      const allProducts = [
        ...productTags.map((pt) => pt.product),
        ...projectProductTags.map((ppt) => ppt.product),
        ...selectionProducts,
      ];

      // Deduplicate by product ID and separate eligible from skipped
      const productMap = new Map<string, {
        id: string;
        imageUrl: string | null;
        name: string;
        cutoutImageUrl: string | null;
        vendor?: { name: string | null; companyName: string | null } | null;
      }>();
      for (const product of allProducts) {
        if (!productMap.has(product.id)) {
          productMap.set(product.id, product);
        }
      }

      // Separate eligible from skipped based on force parameter
      for (const product of Array.from(productMap.values())) {
        if (!product.imageUrl) continue;

        // If force=true, we ignore existing cutouts and re-run everything
        if (force) {
          eligibleProducts.push({
            id: product.id,
            imageUrl: product.imageUrl,
            name: product.name,
            vendor: product.vendor,
          });
        } else {
          // Default behavior: only generate for products that don't have cutouts yet
          if (product.cutoutImageUrl === null) {
            eligibleProducts.push({
              id: product.id,
              imageUrl: product.imageUrl,
              name: product.name,
              vendor: product.vendor,
            });
          } else {
            skippedProducts.push({
              id: product.id,
              name: product.name,
              cutoutImageUrl: product.cutoutImageUrl,
            });
          }
        }
      }
    }

    // Build results array - start with skipped products
    const results: Array<{
      productId: string;
      status: 'success' | 'skipped' | 'failed';
      reason?: 'already_has_cutout';
      cutoutUrl?: string;
      error?: string;
    }> = skippedProducts.map((product) => ({
      productId: product.id,
      status: 'skipped' as const,
      reason: 'already_has_cutout' as const,
      cutoutUrl: product.cutoutImageUrl,
    }));

    // If no eligible products, return early with skipped count
    if (eligibleProducts.length === 0) {
      return NextResponse.json({
        projectId,
        processedCount: 0,
        skippedCount: skippedProducts.length,
        results,
        message: force
          ? 'No products found to regenerate cutouts for.'
          : skippedProducts.length > 0
            ? `All ${skippedProducts.length} product(s) already have 2D cutouts. Use ?force=true to regenerate.`
            : 'No eligible products found. Products must have an imageUrl and no existing cutoutImageUrl.',
      });
    }

    // Process eligible products with limited concurrency (2-3 at a time)
    const CONCURRENCY_LIMIT = 3;

    for (let i = 0; i < eligibleProducts.length; i += CONCURRENCY_LIMIT) {
      const batch = eligibleProducts.slice(i, i + CONCURRENCY_LIMIT);
      
      await Promise.all(
        batch.map(async (product) => {
          try {
            // Double-check that cutoutImageUrl is still null (race condition guard)
            // Skip this check if force=true since we're regenerating anyway
            if (!force) {
              const currentProduct = await prisma.product.findUnique({
                where: { id: product.id },
                select: { cutoutImageUrl: true },
              });

              if (currentProduct?.cutoutImageUrl) {
                // Product was processed by another request - skip it
                results.push({
                  productId: product.id,
                  status: 'skipped',
                  reason: 'already_has_cutout',
                  cutoutUrl: currentProduct.cutoutImageUrl,
                });
                console.log('[2D CUTOUT] Skipped (race condition):', {
                  productId: product.id,
                  productName: product.name,
                });
                return;
              }
            }

            // Build intelligent prompts from product information
            const vendorName = product.vendor?.companyName ?? product.vendor?.name ?? null;
            const prompts = promptOverride
              ? [promptOverride]
              : buildPromptsFromProduct({
                  name: product.name,
                  vendorName,
                });

            console.log('[2D CUTOUT] Attempting generation for product:', {
              productId: product.id,
              productName: product.name,
              imageUrl: product.imageUrl,
              prompts,
            });

            // Call Roboflow workflow directly with prompts
            const roboflowPayload = {
              api_key: process.env.ROBOFLOW_API_KEY,
              inputs: {
                image: { type: "url", value: product.imageUrl },
                prompts,
              },
            };

            const roboflowUrl = process.env.ROBOFLOW_RUN_URL || process.env.ROBOFLOW_SAM3_WORKFLOW_URL;
            if (!roboflowUrl) {
              throw new Error('ROBOFLOW_RUN_URL or ROBOFLOW_SAM3_WORKFLOW_URL environment variable is required');
            }

            const response = await fetch(roboflowUrl, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify(roboflowPayload),
            });

            if (!response.ok) {
              const text = await response.text().catch(() => "<no body>");
              console.error("[2D CUTOUT] Roboflow error", {
                status: response.status,
                statusText: response.statusText,
                body: text,
                imageUrl: product.imageUrl,
                productId: product.id,
                prompts,
              });
              throw new Error(`Roboflow API error: ${response.status} ${response.statusText}`);
            }

            const json = await response.json();

            // Extract cutout URL from Roboflow response
            // Try multiple possible paths based on actual response structure
            const cutoutUrl: string | undefined =
              json?.outputs?.[0]?.mask_visualization?.value ? // base64 in value field
                (json.outputs[0].mask_visualization.value.startsWith('data:') 
                  ? json.outputs[0].mask_visualization.value 
                  : json.outputs[0].mask_visualization.value.startsWith('/9j/') || json.outputs[0].mask_visualization.value.startsWith('iVBORw0KGgo')
                  ? `data:image/${json.outputs[0].mask_visualization.value.startsWith('/9j/') ? 'jpeg' : 'png'};base64,${json.outputs[0].mask_visualization.value}`
                  : undefined)
                : json?.outputs?.[0]?.image
                ?? json?.image
                ?? json?.outputs?.[0]?.url
                ?? json?.url;

            if (!cutoutUrl) {
              console.error("[2D CUTOUT] No cutout image URL returned", {
                productId: product.id,
                imageUrl: product.imageUrl,
                responseKeys: Object.keys(json),
                outputsPreview: json.outputs ? JSON.stringify(json.outputs).substring(0, 500) : 'no outputs',
              });
              throw new Error("Roboflow response does not contain cutout image URL");
            }

            // Fetch the cutout image
            let cutoutBuffer: Buffer;
            
            if (cutoutUrl.startsWith('data:image/')) {
              // Handle base64 data URI
              const base64Data = cutoutUrl.split(',')[1];
              cutoutBuffer = Buffer.from(base64Data, 'base64');
            } else if (cutoutUrl.startsWith('http://') || cutoutUrl.startsWith('https://')) {
              // Fetch from URL
              const cutoutRes = await fetch(cutoutUrl);
              if (!cutoutRes.ok) {
                throw new Error(`Failed to fetch cutout image: ${cutoutRes.status} ${cutoutRes.statusText}`);
              }
              const cutoutArrayBuffer = await cutoutRes.arrayBuffer();
              cutoutBuffer = Buffer.from(cutoutArrayBuffer);
            } else {
              // Assume it's raw base64
              cutoutBuffer = Buffer.from(cutoutUrl, 'base64');
            }

            // Color/tone normalization: mild brightness/contrast, reduce saturation
            const processedBuffer = await sharp(cutoutBuffer)
              .modulate({
                brightness: 1.05, // tiny bump
                saturation: 0.9,  // dial down nuclear colors
              })
              .toBuffer();

            // Upload the balanced cutout via storage helper
            const { ulid } = await import("ulid");
            const cutoutFilename = `${product.id}-cutout.png`;
            const uploadResult = await uploadGeneratedCutout({
              buffer: processedBuffer,
              filename: cutoutFilename,
              mimeType: 'image/png',
            });

            // Persist the URL on the product row - this makes the operation idempotent
            // Subsequent calls will see cutoutImageUrl non-null and skip this product
            await prisma.product.update({
              where: { id: product.id },
              data: { cutoutImageUrl: uploadResult.publicUrl },
            });

            results.push({
              productId: product.id,
              status: 'success',
              cutoutUrl: uploadResult.publicUrl,
            });

            console.log('[2D CUTOUT] Success:', {
              productId: product.id,
              productName: product.name,
              cutoutUrl: uploadResult.publicUrl,
              prompts,
            });
          } catch (error: any) {
            const errorMessage = error.message || 'Unknown error';
            results.push({
              productId: product.id,
              status: 'failed',
              error: errorMessage,
            });

            console.error('[2D CUTOUT] Product processing failed:', {
              productId: product.id,
              productName: product.name,
              imageUrl: product.imageUrl,
              error: errorMessage,
              stack: error.stack,
              prompts: buildPromptsFromProduct({
                name: product.name,
                vendorName: product.vendor?.companyName ?? product.vendor?.name ?? null,
              }),
            });
          }
        })
      );
    }

    const successCount = results.filter((r) => r.status === 'success').length;
    const skippedCount = results.filter((r) => r.status === 'skipped').length;
    const failedCount = results.filter((r) => r.status === 'failed').length;
    const attemptedCount = eligibleProducts.length; // Total products we attempted to process
    const processedCount = successCount + failedCount; // Only count products we actually attempted

    // Soft failure: return 200 even if all failed (for demo robustness)
    if (processedCount > 0 && successCount === 0 && failedCount > 0) {
      // Log all failure details for debugging
      const failedResults = results.filter((r) => r.status === 'failed');
      console.warn('[2D CUTOUT] All eligible products failed for project', projectId, {
        attempted: attemptedCount,
        failed: failedCount,
        skipped: skippedCount,
        failedProducts: failedResults.map((r) => ({
          productId: r.productId,
          error: r.error,
        })),
      });
      return NextResponse.json(
        {
          success: false,
          projectId,
          message: 'All eligible products failed to generate 2D cutouts. Check server console logs for detailed error information.',
          stats: {
            attempted: attemptedCount,
            succeeded: successCount,
            failed: failedCount,
            skipped: skippedCount,
          },
          results,
        },
        { status: 200 } // Return 200 for soft failure
      );
    }

    return NextResponse.json({
      success: true,
      projectId,
      message: successCount > 0 
        ? `Generated ${successCount} cutout(s). ${skippedCount > 0 ? `${skippedCount} already had cutouts.` : ''}` 
        : 'No eligible products to process.',
      stats: {
        attempted: attemptedCount,
        succeeded: successCount,
        failed: failedCount,
        skipped: skippedCount,
      },
      processedCount, // Count of products that actually had cutouts generated this run
      results,
    });
  } catch (error: any) {
    console.error('[2D CUTOUT] Route-level error:', {
      projectId,
      error: error.message || 'Unknown error',
      errorName: error.name,
      stack: error.stack,
    });

    // Return 200 for route-level errors too (soft failure)
    return NextResponse.json(
      {
        success: false,
        projectId,
        error: 'Failed to generate 2D cutouts',
        message: error.message || 'Unknown error occurred. Check server logs for details.',
        stats: {
          attempted: 0,
          succeeded: 0,
          failed: 0,
          skipped: 0,
        },
        results: [],
      },
      { status: 200 }
    );
  }
}
