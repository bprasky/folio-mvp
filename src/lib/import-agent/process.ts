import { prisma } from '@/lib/prisma';
import { analyzeImage, shouldAnalyzeImage } from './analyze';
import { searchProductAttribution } from './attribute';
import type { ExtractedImage, ProcessingResult, RoomAnalysis, ProductAttribution } from './types';

/**
 * Process extracted images from a presentation import
 */
export async function processImportImages(
  sessionId: string,
  images: ExtractedImage[],
  options?: {
    projectId?: string;
    userId: string;
    preferredVendors?: string[];
  }
): Promise<ProcessingResult> {
  const result: ProcessingResult = {
    success: false,
    totalImages: images.length,
    analyzedImages: 0,
    totalProducts: 0,
    pendingTagsCreated: 0,
  };

  try {
    // Update session to processing
    await prisma.importSession.update({
      where: { id: sessionId },
      data: {
        status: 'PROCESSING',
        totalImages: images.length,
      },
    });

    const allPendingTags: Array<{
      importSessionId: string;
      tempImageUrl: string | null;
      projectImageId: string | null;
      x: number;
      y: number;
      description: string;
      category: string;
      searchQuery: string;
      suggestions: ProductAttribution[];
      topSuggestion: ProductAttribution | null;
      detectionConfidence: string;
      attributionConfidence: string | null;
      status: 'UNREVIEWED';
    }> = [];

    // Process each image
    for (let i = 0; i < images.length; i++) {
      const image = images[i];

      // Skip already-skipped images (e.g., title slides)
      if (image.isSkipped) {
        continue;
      }

      // Check if image should be analyzed
      const imageSource = image.url
        ? { type: 'url' as const, url: image.url }
        : { type: 'base64' as const, data: image.base64, mediaType: image.mimeType };

      const checkResult = await shouldAnalyzeImage(imageSource);
      if (!checkResult.shouldAnalyze) {
        console.log(`Skipping image ${i + 1}: ${checkResult.reason}`);
        continue;
      }

      // Analyze the image
      const analysis = await analyzeImage(imageSource);
      result.analyzedImages++;

      if (analysis.products.length === 0) {
        console.log(`No products detected in image ${i + 1}`);
        continue;
      }

      result.totalProducts += analysis.products.length;

      // Search for product attributions
      for (const product of analysis.products) {
        const attributions = await searchProductAttribution(product, {
          preferredVendors: options?.preferredVendors,
        });

        allPendingTags.push({
          importSessionId: sessionId,
          tempImageUrl: image.url || null,
          projectImageId: null,
          x: product.position.x,
          y: product.position.y,
          description: product.description,
          category: product.category,
          searchQuery: product.searchQuery,
          suggestions: attributions,
          topSuggestion: attributions[0] || null,
          detectionConfidence: product.confidence,
          attributionConfidence: attributions[0]?.confidence || null,
          status: 'UNREVIEWED' as const,
        });
      }

      // Update progress
      await prisma.importSession.update({
        where: { id: sessionId },
        data: {
          processingMeta: {
            processedImages: i + 1,
            totalImages: images.length,
            productsDetected: result.totalProducts,
          },
        },
      });
    }

    // Batch insert pending tags
    if (allPendingTags.length > 0) {
      await prisma.pendingProductTag.createMany({
        data: allPendingTags.map(tag => ({
          importSessionId: tag.importSessionId,
          tempImageUrl: tag.tempImageUrl,
          projectImageId: tag.projectImageId,
          x: tag.x,
          y: tag.y,
          description: tag.description,
          category: tag.category,
          searchQuery: tag.searchQuery,
          suggestions: tag.suggestions as unknown as object,
          topSuggestion: tag.topSuggestion as unknown as object,
          detectionConfidence: tag.detectionConfidence,
          attributionConfidence: tag.attributionConfidence,
          status: tag.status,
        })),
      });
      result.pendingTagsCreated = allPendingTags.length;
    }

    // Update session to ready for review
    await prisma.importSession.update({
      where: { id: sessionId },
      data: {
        status: 'READY_FOR_REVIEW',
        totalProducts: result.totalProducts,
        processingMeta: {
          processedImages: result.analyzedImages,
          totalImages: images.length,
          productsDetected: result.totalProducts,
          pendingTagsCreated: result.pendingTagsCreated,
        },
      },
    });

    result.success = true;
    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Import processing failed:', error);

    await prisma.importSession.update({
      where: { id: sessionId },
      data: {
        status: 'FAILED',
        errorMessage,
      },
    });

    result.error = errorMessage;
    return result;
  }
}

/**
 * Analyze a single image and return results (for preview/testing)
 */
export async function analyzeImagePreview(
  imageUrl: string
): Promise<RoomAnalysis & { shouldAnalyze: boolean }> {
  const imageSource = { type: 'url' as const, url: imageUrl };

  const checkResult = await shouldAnalyzeImage(imageSource);
  if (!checkResult.shouldAnalyze) {
    return {
      roomType: 'other',
      products: [],
      styleIndicators: [],
      dominantColors: [],
      materials: [],
      shouldAnalyze: false,
    };
  }

  const analysis = await analyzeImage(imageSource);
  return {
    ...analysis,
    shouldAnalyze: true,
  };
}

/**
 * Get processing status for a session
 */
export async function getImportSessionStatus(sessionId: string) {
  const session = await prisma.importSession.findUnique({
    where: { id: sessionId },
    include: {
      _count: {
        select: {
          pendingTags: true,
        },
      },
    },
  });

  if (!session) return null;

  const pendingTagsByStatus = await prisma.pendingProductTag.groupBy({
    by: ['status'],
    where: { importSessionId: sessionId },
    _count: true,
  });

  const statusCounts = pendingTagsByStatus.reduce((acc, item) => {
    acc[item.status] = item._count;
    return acc;
  }, {} as Record<string, number>);

  return {
    ...session,
    pendingTagsCount: session._count.pendingTags,
    statusCounts,
    progress: session.status === 'PROCESSING'
      ? (session.processingMeta as { processedImages?: number; totalImages?: number } | null)
      : null,
  };
}
