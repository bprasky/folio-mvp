import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { processImportImages, processImportPdf } from '@/lib/import-agent/process';
import type { ExtractedImage, PdfDocument } from '@/lib/import-agent/types';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes for AI analysis

/**
 * POST /api/import/[sessionId]/analyze
 * Trigger AI analysis on extracted images or PDF documents
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string })?.id;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { sessionId } = await params;

    // Get import session
    const importSession = await prisma.importSession.findFirst({
      where: { id: sessionId, userId },
    });

    if (!importSession) {
      return NextResponse.json({ error: 'Import session not found' }, { status: 404 });
    }

    // Get stored images and PDF documents from processing meta
    const processingMeta = importSession.processingMeta as {
      storedImages?: Array<{ pageNumber: number; url: string }>;
      pdfDocuments?: Array<{ url: string; pageCount: number; fileName: string }>;
    } | null;

    const storedImages = processingMeta?.storedImages || [];
    const pdfDocuments = processingMeta?.pdfDocuments || [];

    // Check if we have anything to analyze
    if (storedImages.length === 0 && pdfDocuments.length === 0) {
      return NextResponse.json(
        { error: 'No images or documents to analyze. Please upload a presentation first.' },
        { status: 400 }
      );
    }

    // If we have PDF documents but no images, use PDF analysis
    if (storedImages.length === 0 && pdfDocuments.length > 0) {
      console.log(`Using PDF document analysis for ${pdfDocuments.length} PDFs`);

      // Start PDF analysis in background
      processPdfAnalysisInBackground(sessionId, pdfDocuments, userId, importSession.projectId);

      return NextResponse.json({
        status: 'processing',
        message: 'PDF analysis started',
        totalDocuments: pdfDocuments.length,
        totalPages: pdfDocuments.reduce((sum, doc) => sum + doc.pageCount, 0),
      });
    }

    // Convert to ExtractedImage format for image analysis
    const images: ExtractedImage[] = storedImages.map((img, index) => ({
      pageNumber: img.pageNumber || index + 1,
      url: img.url,
      mimeType: 'image/jpeg', // Default, actual type determined by URL
      isSkipped: false,
    }));

    // Start background processing
    // In production, this would be a queue job. For now, we process inline.
    processAnalysisInBackground(sessionId, images, userId, importSession.projectId);

    return NextResponse.json({
      status: 'processing',
      message: 'Analysis started',
      totalImages: images.length,
    });
  } catch (error) {
    console.error('Error starting analysis:', error);
    return NextResponse.json(
      { error: 'Failed to start analysis' },
      { status: 500 }
    );
  }
}

/**
 * Process PDF documents in background using Claude's document API
 */
async function processPdfAnalysisInBackground(
  sessionId: string,
  pdfDocuments: PdfDocument[],
  userId: string,
  projectId: string | null
) {
  try {
    console.log(`Starting PDF analysis for session ${sessionId} with ${pdfDocuments.length} documents`);

    // Update status to processing
    await prisma.importSession.update({
      where: { id: sessionId },
      data: { status: 'PROCESSING' },
    });

    // Process PDFs with the import agent
    const result = await processImportPdf(sessionId, pdfDocuments, {
      userId,
      projectId: projectId || undefined,
    });

    if (result.success) {
      console.log(`PDF analysis complete: ${result.analyzedImages} pages analyzed, ${result.totalProducts} products detected`);

      // Update session to ready for review
      await prisma.importSession.update({
        where: { id: sessionId },
        data: {
          status: 'READY_FOR_REVIEW',
          totalProducts: result.totalProducts,
          processingMeta: {
            ...(await getExistingMeta(sessionId)),
            processedPages: result.analyzedImages,
            productsDetected: result.totalProducts,
            pendingTagsCreated: result.pendingTagsCreated,
            completedAt: new Date().toISOString(),
          },
        },
      });
    } else {
      console.error(`PDF analysis failed: ${result.error}`);

      await prisma.importSession.update({
        where: { id: sessionId },
        data: {
          status: 'FAILED',
          errorMessage: result.error || 'PDF analysis failed',
        },
      });
    }
  } catch (error) {
    console.error('PDF background processing error:', error);

    await prisma.importSession.update({
      where: { id: sessionId },
      data: {
        status: 'FAILED',
        errorMessage: error instanceof Error ? error.message : 'PDF processing failed',
      },
    });
  }
}

/**
 * Process images in background
 * This runs asynchronously and updates the session status
 */
async function processAnalysisInBackground(
  sessionId: string,
  images: ExtractedImage[],
  userId: string,
  projectId: string | null
) {
  try {
    console.log(`Starting analysis for session ${sessionId} with ${images.length} images`);

    // Update status to processing
    await prisma.importSession.update({
      where: { id: sessionId },
      data: { status: 'PROCESSING' },
    });

    // Process images with the import agent
    const result = await processImportImages(sessionId, images, {
      userId,
      projectId: projectId || undefined,
    });

    if (result.success) {
      console.log(`Analysis complete: ${result.analyzedImages} images analyzed, ${result.totalProducts} products detected`);

      // Update session to ready for review
      await prisma.importSession.update({
        where: { id: sessionId },
        data: {
          status: 'READY_FOR_REVIEW',
          totalProducts: result.totalProducts,
          processingMeta: {
            ...(await getExistingMeta(sessionId)),
            processedImages: result.analyzedImages,
            productsDetected: result.totalProducts,
            pendingTagsCreated: result.pendingTagsCreated,
            completedAt: new Date().toISOString(),
          },
        },
      });
    } else {
      console.error(`Analysis failed: ${result.error}`);

      await prisma.importSession.update({
        where: { id: sessionId },
        data: {
          status: 'FAILED',
          errorMessage: result.error || 'Analysis failed',
        },
      });
    }
  } catch (error) {
    console.error('Background processing error:', error);

    await prisma.importSession.update({
      where: { id: sessionId },
      data: {
        status: 'FAILED',
        errorMessage: error instanceof Error ? error.message : 'Processing failed',
      },
    });
  }
}

async function getExistingMeta(sessionId: string): Promise<Record<string, unknown>> {
  const session = await prisma.importSession.findUnique({
    where: { id: sessionId },
    select: { processingMeta: true },
  });
  return (session?.processingMeta as Record<string, unknown>) || {};
}
