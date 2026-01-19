import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { processImportImages } from '@/lib/import-agent/process';
import type { ExtractedImage } from '@/lib/import-agent/types';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes for AI analysis

/**
 * POST /api/import/[sessionId]/analyze
 * Trigger AI analysis on extracted images
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

    // Get stored images from processing meta
    const processingMeta = importSession.processingMeta as {
      storedImages?: Array<{ pageNumber: number; url: string }>;
    } | null;

    const storedImages = processingMeta?.storedImages || [];

    if (storedImages.length === 0) {
      return NextResponse.json(
        { error: 'No images to analyze. Please upload a presentation first.' },
        { status: 400 }
      );
    }

    // Convert to ExtractedImage format
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
