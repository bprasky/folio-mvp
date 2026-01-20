import { prisma } from '@/lib/prisma';
import { analyzeImage, shouldAnalyzeImage, analyzePdfDocument } from './analyze';
import { searchProductAttribution } from './attribute';
import type { ExtractedImage, ProcessingResult, RoomAnalysis, ProductAttribution, PdfDocument } from './types';

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
      roomType?: string;
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
          roomType: analysis.roomType, // Include room type from image analysis
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
          roomType: tag.roomType,
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
 * Upload PDF to Cloudinary and get page image URLs
 * Returns a map of page number -> image URL
 */
async function uploadPdfToCloudinaryForPages(
  pdfUrl: string,
  pageCount: number,
  fileName: string
): Promise<Map<number, string>> {
  const pageUrlMap = new Map<number, string>();

  const cloudinaryUrl = process.env.CLOUDINARY_URL;
  if (!cloudinaryUrl) {
    console.log('Cloudinary not configured, skipping PDF-to-image conversion');
    return pageUrlMap;
  }

  try {
    // Fetch PDF from the signed URL
    console.log(`Fetching PDF from: ${pdfUrl.substring(0, 100)}...`);
    const pdfResponse = await fetch(pdfUrl);
    if (!pdfResponse.ok) {
      console.error(`Failed to fetch PDF: ${pdfResponse.status}`);
      return pageUrlMap;
    }
    const pdfBuffer = Buffer.from(await pdfResponse.arrayBuffer());

    // Dynamic import cloudinary
    const cloudinary = await import('cloudinary');

    // Upload PDF to Cloudinary
    const uploadResult = await new Promise<{ public_id: string; secure_url: string }>((resolve, reject) => {
      const uploadStream = cloudinary.v2.uploader.upload_stream(
        {
          resource_type: 'raw',
          folder: 'pdf-imports',
          format: 'pdf',
          public_id: `pdf-${Date.now()}-${fileName.replace(/[^a-z0-9]/gi, '-')}`,
        },
        (error, result) => {
          if (error) reject(error);
          else if (result) resolve(result);
          else reject(new Error('No result from Cloudinary'));
        }
      );
      uploadStream.end(pdfBuffer);
    });

    console.log(`PDF uploaded to Cloudinary: ${uploadResult.public_id}`);

    // Generate image URLs for each page
    for (let page = 1; page <= pageCount; page++) {
      const imageUrl = cloudinary.v2.url(uploadResult.public_id, {
        resource_type: 'image',
        format: 'jpg',
        transformation: [
          { page: page },
          { width: 1200, crop: 'limit' },
          { quality: 'auto:good' },
        ],
      });
      pageUrlMap.set(page, imageUrl);
    }

    console.log(`Generated ${pageUrlMap.size} page image URLs from Cloudinary`);

    // Note: We don't delete the PDF from Cloudinary here since we need the URLs to persist
    // Consider a cleanup job or TTL setting in Cloudinary
  } catch (error) {
    console.error('Failed to upload PDF to Cloudinary for page URLs:', error);
  }

  return pageUrlMap;
}

/**
 * Process PDF documents directly using Claude's document API
 * This is used when PDF-to-image conversion fails in serverless environments
 */
export async function processImportPdf(
  sessionId: string,
  pdfDocuments: PdfDocument[],
  options?: {
    projectId?: string;
    userId: string;
    preferredVendors?: string[];
  }
): Promise<ProcessingResult> {
  const totalPages = pdfDocuments.reduce((sum, doc) => sum + doc.pageCount, 0);

  const result: ProcessingResult = {
    success: false,
    totalImages: totalPages, // Using pages as "images" for consistency
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
        totalImages: totalPages,
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
      pageNumber?: number;
      roomType?: string;
    }> = [];

    // Process each PDF document
    for (const pdfDoc of pdfDocuments) {
      console.log(`Analyzing PDF: ${pdfDoc.fileName} (${pdfDoc.pageCount} pages)`);

      try {
        // Analyze PDF using Claude's document API
        const analysis = await analyzePdfDocument(pdfDoc.url);
        result.analyzedImages += pdfDoc.pageCount;

        if (analysis.pages.length === 0) {
          console.log(`No interior design content found in ${pdfDoc.fileName}`);
          continue;
        }

        console.log(`Found ${analysis.pages.length} interior pages with content`);

        // Upload PDF to Cloudinary to get image URLs for each page
        // This converts PDF pages to displayable images
        const pageImageUrls = await uploadPdfToCloudinaryForPages(
          pdfDoc.url,
          pdfDoc.pageCount,
          pdfDoc.fileName
        );

        // Process each page's analysis
        for (const pageAnalysis of analysis.pages) {
          result.totalProducts += pageAnalysis.products.length;

          // Get the image URL for this page (fall back to PDF URL if Cloudinary failed)
          const pageImageUrl = pageImageUrls.get(pageAnalysis.pageNumber) || pdfDoc.url;

          for (const product of pageAnalysis.products) {
            allPendingTags.push({
              importSessionId: sessionId,
              tempImageUrl: pageImageUrl, // Use Cloudinary page image URL
              projectImageId: null,
              x: product.position.x,
              y: product.position.y,
              description: product.description,
              category: product.category,
              searchQuery: product.searchQuery,
              suggestions: [],
              topSuggestion: null,
              detectionConfidence: product.confidence,
              attributionConfidence: null,
              status: 'UNREVIEWED' as const,
              pageNumber: pageAnalysis.pageNumber,
              roomType: pageAnalysis.roomType, // Include room type from analysis
            });
          }
        }

        // Update progress
        await prisma.importSession.update({
          where: { id: sessionId },
          data: {
            processingMeta: {
              processedPages: result.analyzedImages,
              totalPages,
              productsDetected: result.totalProducts,
            },
          },
        });
      } catch (docError) {
        const errorMsg = docError instanceof Error ? docError.message : 'Unknown error';
        console.error(`Error analyzing PDF ${pdfDoc.fileName}:`, errorMsg);

        // Update session with error but continue if there are more documents
        if (pdfDocuments.length === 1) {
          // Only one document and it failed - throw to trigger failure status
          throw new Error(`PDF analysis failed: ${errorMsg}`);
        }
      }
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
          roomType: tag.roomType,
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
          processedPages: result.analyzedImages,
          totalPages,
          productsDetected: result.totalProducts,
          pendingTagsCreated: result.pendingTagsCreated,
        },
      },
    });

    result.success = true;
    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('PDF import processing failed:', error);

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
