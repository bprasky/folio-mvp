import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { isWorkspaceImport } from '@/lib/workspace-import/types';
// Import directly from process.ts to avoid barrel export issues
import { processImportImages, processImportPdf } from '@/lib/import-agent/process';
import type { ExtractedImage, PdfDocument } from '@/lib/import-agent/types';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes for AI analysis

// Log that the module loaded successfully
console.log('[analyze route] Module loaded successfully');

/**
 * POST /api/import/[sessionId]/analyze
 * Trigger AI analysis on extracted images or PDF documents
 * NOTE: This runs synchronously because Vercel serverless can't do background work
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  console.log('[analyze route] POST handler called');
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
    if (isWorkspaceImport(importSession.processingMeta)) return NextResponse.json({ error: 'Manage this import from your workspace.' }, { status: 409 });
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

    // Update status to processing immediately
    await prisma.importSession.update({
      where: { id: sessionId },
      data: { status: 'PROCESSING' },
    });

    // If we have PDF documents but no images, use PDF analysis
    if (storedImages.length === 0 && pdfDocuments.length > 0) {
      console.log(`Running synchronous PDF analysis for ${pdfDocuments.length} PDFs`);

      try {
        // Run PDF analysis SYNCHRONOUSLY (not in background - serverless can't do that)
        const result = await processImportPdf(sessionId, pdfDocuments, {
          userId,
          projectId: importSession.projectId || undefined,
        });

        if (result.success) {
          return NextResponse.json({
            status: 'completed',
            message: 'PDF analysis completed',
            totalDocuments: pdfDocuments.length,
            totalProducts: result.totalProducts,
            analyzedPages: result.analyzedImages,
          });
        } else {
          return NextResponse.json({
            status: 'failed',
            error: result.error || 'PDF analysis failed',
          }, { status: 500 });
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        console.error('PDF analysis error:', errorMsg);

        await prisma.importSession.update({
          where: { id: sessionId },
          data: {
            status: 'FAILED',
            errorMessage: errorMsg,
          },
        });

        return NextResponse.json({
          status: 'failed',
          error: errorMsg,
        }, { status: 500 });
      }
    }

    // Convert to ExtractedImage format for image analysis
    const images: ExtractedImage[] = storedImages.map((img, index) => ({
      pageNumber: img.pageNumber || index + 1,
      url: img.url,
      mimeType: 'image/jpeg',
      isSkipped: false,
    }));

    console.log(`Running synchronous image analysis for ${images.length} images`);

    try {
      // Run image analysis SYNCHRONOUSLY
      const result = await processImportImages(sessionId, images, {
        userId,
        projectId: importSession.projectId || undefined,
      });

      if (result.success) {
        return NextResponse.json({
          status: 'completed',
          message: 'Analysis completed',
          totalImages: images.length,
          totalProducts: result.totalProducts,
          analyzedImages: result.analyzedImages,
        });
      } else {
        return NextResponse.json({
          status: 'failed',
          error: result.error || 'Analysis failed',
        }, { status: 500 });
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error('Image analysis error:', errorMsg);

      await prisma.importSession.update({
        where: { id: sessionId },
        data: {
          status: 'FAILED',
          errorMessage: errorMsg,
        },
      });

      return NextResponse.json({
        status: 'failed',
        error: errorMsg,
      }, { status: 500 });
    }
  } catch (error) {
    console.error('Error in analyze endpoint:', error);
    return NextResponse.json(
      { error: 'Failed to start analysis' },
      { status: 500 }
    );
  }
}

async function getExistingMeta(sessionId: string): Promise<Record<string, unknown>> {
  const session = await prisma.importSession.findUnique({
    where: { id: sessionId },
    select: { processingMeta: true },
  });
  return (session?.processingMeta as Record<string, unknown>) || {};
}
