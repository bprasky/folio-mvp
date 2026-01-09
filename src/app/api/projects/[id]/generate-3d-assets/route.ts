export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { assertProjectView } from '@/lib/authz/access';
import { prisma } from '@/lib/prisma';
import { generateProductMeshFromImageUrl } from '@/lib/roboflow/sam3Mesh';
import { uploadGeneratedMesh } from '@/lib/storage';

type RequestBody = {
  productIds?: string[];
  promptOverride?: string;
};

// TODO: restrict 3D generation to premium designer tier once billing is wired
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const projectId = params.id;

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

    // Default prompt for 3D generation
    // Note: If promptOverride is not provided, we pass undefined to let sam3Mesh use its default ("furniture product")
    const prompt = promptOverride;

    // Fetch project to ensure it exists
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, title: true },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Find all products associated with this project
    // IMPORTANT: threeDAssetUrl IS NULL is the source of truth - we never regenerate if it exists
    let eligibleProducts: Array<{ id: string; imageUrl: string; name: string }> = [];
    let skippedProducts: Array<{ id: string; name: string; threeDAssetUrl: string }> = [];

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
          threeDAssetUrl: true,
        },
      });

      // Separate eligible (no threeDAssetUrl) from skipped (already has threeDAssetUrl)
      for (const product of products) {
        if (product.imageUrl && product.threeDAssetUrl === null) {
          eligibleProducts.push({
            id: product.id,
            imageUrl: product.imageUrl,
            name: product.name,
          });
        } else if (product.threeDAssetUrl !== null) {
          skippedProducts.push({
            id: product.id,
            name: product.name,
            threeDAssetUrl: product.threeDAssetUrl,
          });
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
              threeDAssetUrl: true,
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
              threeDAssetUrl: true,
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
              threeDAssetUrl: true,
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
      const productMap = new Map<string, { id: string; imageUrl: string | null; name: string; threeDAssetUrl: string | null }>();
      for (const product of allProducts) {
        if (!productMap.has(product.id)) {
          productMap.set(product.id, product);
        }
      }

      // Separate eligible (no threeDAssetUrl) from skipped (already has threeDAssetUrl)
      for (const product of productMap.values()) {
        if (product.imageUrl !== null && product.threeDAssetUrl === null) {
          eligibleProducts.push({
            id: product.id,
            imageUrl: product.imageUrl,
            name: product.name,
          });
        } else if (product.threeDAssetUrl !== null) {
          skippedProducts.push({
            id: product.id,
            name: product.name,
            threeDAssetUrl: product.threeDAssetUrl,
          });
        }
      }
    }

    // Build results array - start with skipped products
    const results: Array<{
      productId: string;
      status: 'success' | 'skipped' | 'failed';
      reason?: 'already_has_mesh';
      meshUrl?: string;
      error?: string;
    }> = skippedProducts.map((product) => ({
      productId: product.id,
      status: 'skipped' as const,
      reason: 'already_has_mesh' as const,
      meshUrl: product.threeDAssetUrl,
    }));

    // If no eligible products, return early with skipped count
    if (eligibleProducts.length === 0) {
      return NextResponse.json({
        projectId,
        processedCount: 0,
        skippedCount: skippedProducts.length,
        results,
        message: skippedProducts.length > 0
          ? `All ${skippedProducts.length} product(s) already have 3D assets. No new meshes generated.`
          : 'No eligible products found. Products must have an imageUrl and no existing threeDAssetUrl.',
      });
    }

    // Process eligible products with limited concurrency (2 at a time)
    const CONCURRENCY_LIMIT = 2;

    for (let i = 0; i < eligibleProducts.length; i += CONCURRENCY_LIMIT) {
      const batch = eligibleProducts.slice(i, i + CONCURRENCY_LIMIT);
      
      await Promise.all(
        batch.map(async (product) => {
          try {
            // Double-check that threeDAssetUrl is still null (race condition guard)
            const currentProduct = await prisma.product.findUnique({
              where: { id: product.id },
              select: { threeDAssetUrl: true },
            });

            if (currentProduct?.threeDAssetUrl) {
              // Product was processed by another request - skip it
              results.push({
                productId: product.id,
                status: 'skipped',
                reason: 'already_has_mesh',
                meshUrl: currentProduct.threeDAssetUrl,
              });
              console.log('[3D MESH] Skipped (race condition):', {
                productId: product.id,
                productName: product.name,
              });
              return;
            }

            // Generate mesh from image - wrap in try/catch for detailed error logging
            let meshResult;
            try {
              console.log('[3D MESH] Attempting generation for product:', {
                productId: product.id,
                productName: product.name,
                imageUrl: product.imageUrl,
              });
              
              meshResult = await generateProductMeshFromImageUrl(
                product.imageUrl,
                product.id,
                { prompt }
              );
            } catch (meshError: any) {
              // Log detailed Roboflow error information
              console.error('[3D MESH] Roboflow generation failed:', {
                productId: product.id,
                productName: product.name,
                imageUrl: product.imageUrl,
                error: meshError.message || 'Unknown error',
                errorName: meshError.name,
                stack: meshError.stack,
              });
              throw meshError; // Re-throw to outer catch
            }

            // Upload mesh to storage
            let uploadResult;
            try {
              uploadResult = await uploadGeneratedMesh({
                buffer: meshResult.meshBuffer,
                filename: meshResult.meshFilename,
                mimeType: meshResult.meshMimeType,
              });
            } catch (uploadError: any) {
              console.error('[3D MESH] Upload failed:', {
                productId: product.id,
                productName: product.name,
                error: uploadError.message || 'Unknown error',
              });
              throw uploadError; // Re-throw to outer catch
            }

            // Persist the URL on the product row - this makes the operation idempotent
            // Subsequent calls will see threeDAssetUrl non-null and skip this product
            await prisma.product.update({
              where: { id: product.id },
              data: { threeDAssetUrl: uploadResult.publicUrl },
            });

            results.push({
              productId: product.id,
              status: 'success',
              meshUrl: uploadResult.publicUrl,
            });

            console.log('[3D MESH] Success:', {
              productId: product.id,
              productName: product.name,
              meshUrl: uploadResult.publicUrl,
            });
          } catch (error: any) {
            const errorMessage = error.message || 'Unknown error';
            results.push({
              productId: product.id,
              status: 'failed',
              error: errorMessage,
            });

            console.error('[3D MESH] Product processing failed:', {
              productId: product.id,
              productName: product.name,
              imageUrl: product.imageUrl,
              error: errorMessage,
              stack: error.stack,
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
      console.warn('[3D MESH] All eligible products failed for project', projectId, {
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
          message: 'All eligible products failed to generate 3D meshes. Check server console logs for detailed error information.',
          stats: {
            attempted: attemptedCount,
            succeeded: successCount,
            failed: failedCount,
            skipped: skippedCount,
          },
          processedCount,
          skippedCount,
          results,
        },
        { status: 200 } // Return 200 for soft failure
      );
    }

    return NextResponse.json({
      success: true,
      projectId,
      message: successCount > 0 
        ? `Generated ${successCount} 3D mesh(es). ${skippedCount > 0 ? `${skippedCount} already had meshes.` : ''}` 
        : 'No eligible products to process.',
      stats: {
        attempted: attemptedCount,
        succeeded: successCount,
        failed: failedCount,
        skipped: skippedCount,
      },
      processedCount, // Count of products that actually had meshes generated this run
      skippedCount,   // Products skipped because threeDAssetUrl already existed
      results,
    });
  } catch (error: any) {
    console.error('[3D MESH] Route-level error:', {
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
        error: 'Failed to generate 3D meshes',
        message: error.message || 'Unknown error occurred. Check server logs for details.',
        stats: {
          attempted: 0,
          succeeded: 0,
          failed: 0,
          skipped: 0,
        },
        processedCount: 0,
        skippedCount: 0,
        results: [],
      },
      { status: 200 }
    );
  }
}

