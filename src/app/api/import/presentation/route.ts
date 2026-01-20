import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';

// We need to import dynamically for server-side PDF/PPTX parsing
// These libraries don't work in Edge runtime

export const runtime = 'nodejs';
export const maxDuration = 60; // 1 minute (compatible with Vercel Pro, Hobby is 10s max)

// Configure body size limit for file uploads (50MB)
export const fetchCache = 'force-no-store';
export const dynamic = 'force-dynamic';

/**
 * POST /api/import/presentation
 * Process presentation files that were uploaded to Supabase storage
 * Extracts images for AI analysis
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string })?.id;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Accept JSON body with file paths (files already uploaded to Supabase)
    const body = await req.json();
    const { sessionId, projectId, filePaths, fileNames } = body as {
      sessionId: string;
      projectId?: string;
      filePaths: string[];
      fileNames: string[];
    };

    if (!filePaths || filePaths.length === 0) {
      return NextResponse.json({ error: 'No file paths provided' }, { status: 400 });
    }

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
    }

    // Verify session exists and belongs to user
    const importSession = await prisma.importSession.findFirst({
      where: { id: sessionId, userId },
    });

    if (!importSession) {
      return NextResponse.json({ error: 'Import session not found' }, { status: 404 });
    }

    // Fetch files from Supabase storage
    const { supabaseAdmin } = await import('@/lib/supabaseAdmin');
    const IMPORTS_BUCKET = 'imports'; // All import files: source presentations + extracted images

    // Process each file and extract images
    const allExtractedImages: Array<{
      pageNumber: number;
      base64: string;
      mimeType: string;
      fileName: string;
    }> = [];

    for (let i = 0; i < filePaths.length; i++) {
      const filePath = filePaths[i];
      const fileName = fileNames[i] || filePath.split('/').pop() || 'unknown';

      // Download file from Supabase imports bucket
      const { data: fileData, error: downloadError } = await supabaseAdmin.storage
        .from(IMPORTS_BUCKET)
        .download(filePath);

      if (downloadError || !fileData) {
        console.error(`Failed to download file ${filePath}:`, downloadError);
        continue;
      }

      const arrayBuffer = await fileData.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      if (fileName.toLowerCase().endsWith('.pdf')) {
        const images = await extractPdfImages(buffer, fileName);
        allExtractedImages.push(...images);
      } else if (fileName.toLowerCase().endsWith('.pptx')) {
        const images = await extractPptxImages(buffer, fileName);
        allExtractedImages.push(...images);
      } else {
        console.warn(`Skipping unsupported file: ${fileName}`);
      }
    }

    // Store extracted images in temp storage and save URLs
    const { ulid } = await import('ulid');

    const storedImages: Array<{
      pageNumber: number;
      url: string;
      mimeType: string;
    }> = [];

    for (const img of allExtractedImages) {
      try {
        const id = ulid();
        const ext = img.mimeType.includes('png') ? 'png' : 'jpg';
        const path = `imports/${sessionId}/${id}.${ext}`;

        const imageBuffer = Buffer.from(img.base64, 'base64');

        const { error } = await supabaseAdmin.storage.from(IMPORTS_BUCKET).upload(path, imageBuffer, {
          contentType: img.mimeType,
          upsert: false,
        });

        if (error) {
          console.error(`Failed to upload image:`, error);
          continue;
        }

        const { data: pub } = supabaseAdmin.storage.from(IMPORTS_BUCKET).getPublicUrl(path);

        storedImages.push({
          pageNumber: img.pageNumber,
          url: pub.publicUrl,
          mimeType: img.mimeType,
        });
      } catch (err) {
        console.error(`Error storing image:`, err);
      }
    }

    // Update session with file info
    await prisma.importSession.update({
      where: { id: sessionId },
      data: {
        fileName: fileNames.join(', '),
        totalImages: storedImages.length,
        processingMeta: {
          extractedImages: storedImages.length,
          totalPages: allExtractedImages.length,
          storedImages: storedImages.map(img => ({
            pageNumber: img.pageNumber,
            url: img.url,
          })),
        },
      },
    });

    return NextResponse.json({
      success: true,
      extractedImages: storedImages,
      totalPages: allExtractedImages.length,
      storedCount: storedImages.length,
    });
  } catch (error) {
    console.error('Error processing presentation:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorName = error instanceof Error ? error.name : 'Unknown';
    const errorStack = error instanceof Error ? error.stack : undefined;

    return NextResponse.json(
      {
        error: 'Failed to process presentation',
        details: errorMessage,
        type: errorName,
        stack: process.env.NODE_ENV === 'development' ? errorStack : undefined,
      },
      { status: 500 }
    );
  }
}

/**
 * Extract images from PDF file
 * For PDFs, we extract embedded images
 */
async function extractPdfImages(
  buffer: Buffer,
  fileName: string
): Promise<Array<{ pageNumber: number; base64: string; mimeType: string; fileName: string }>> {
  const images: Array<{ pageNumber: number; base64: string; mimeType: string; fileName: string }> = [];

  try {
    // Try to use pdf-lib to extract embedded images
    const { PDFDocument } = await import('pdf-lib');
    const pdfDoc = await PDFDocument.load(buffer);
    const pages = pdfDoc.getPages();

    // For now, convert each page to an image using a different approach
    // Since pdf-lib doesn't directly render pages, we'll use the PDF page dimensions
    // and note that full rendering would require a headless browser or canvas-based solution

    // As a workaround, we'll try to extract embedded images from the PDF
    // This is a simplified approach - production would use pdf.js or a rendering service

    // Check for XObject images in the PDF
    const pdfImages = await extractPdfEmbeddedImages(pdfDoc);

    let pageNum = 1;
    for (const img of pdfImages) {
      images.push({
        pageNumber: pageNum++,
        base64: img.base64,
        mimeType: img.mimeType,
        fileName,
      });
    }

    // If no embedded images found, we need to render pages
    // This requires additional infrastructure (like pdf.js with canvas)
    if (images.length === 0) {
      console.log(`PDF has ${pages.length} pages but no extractable embedded images.`);
      console.log('Note: Full page rendering requires additional setup.');

      // Return placeholder info so the UI knows pages exist
      for (let i = 0; i < pages.length; i++) {
        // We can't extract the actual page as an image without rendering
        // In production, this would use pdf.js or a service like Cloudinary
      }
    }

    return images;
  } catch (error) {
    console.error('PDF extraction failed:', error);
    return images;
  }
}

/**
 * Extract embedded images from PDF
 */
async function extractPdfEmbeddedImages(
  pdfDoc: any
): Promise<Array<{ base64: string; mimeType: string }>> {
  const images: Array<{ base64: string; mimeType: string }> = [];

  try {
    // Get all pages
    const pages = pdfDoc.getPages();

    for (const page of pages) {
      // Access the page's resources to find XObjects (images)
      const resources = page.node.Resources();
      if (!resources) continue;

      const xObjects = resources.lookup('XObject', 'PDFDict');
      if (!xObjects) continue;

      // Iterate through XObjects
      const entries = xObjects.entries();
      for (const [name, ref] of entries) {
        try {
          const xObject = ref;
          const subtype = xObject.lookup('Subtype', 'PDFName');

          if (subtype?.toString() === '/Image') {
            // This is an image - try to extract it
            // Note: Full extraction requires handling various compression types
            // This is a simplified version
          }
        } catch (e) {
          // Skip problematic XObjects
        }
      }
    }
  } catch (error) {
    console.error('Error extracting PDF images:', error);
  }

  return images;
}

/**
 * Extract images from PPTX file
 * PPTX files are ZIP archives containing media files
 */
async function extractPptxImages(
  buffer: Buffer,
  fileName: string
): Promise<Array<{ pageNumber: number; base64: string; mimeType: string; fileName: string }>> {
  const images: Array<{ pageNumber: number; base64: string; mimeType: string; fileName: string }> = [];

  try {
    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(buffer);

    // Find all media files in the PPTX
    const mediaFiles = Object.keys(zip.files).filter(
      name =>
        name.startsWith('ppt/media/') &&
        (name.endsWith('.png') ||
          name.endsWith('.jpg') ||
          name.endsWith('.jpeg') ||
          name.endsWith('.gif') ||
          name.endsWith('.webp'))
    );

    // Sort by name to maintain order
    mediaFiles.sort();

    let pageNumber = 1;
    for (const mediaPath of mediaFiles) {
      try {
        const imageData = await zip.files[mediaPath].async('base64');
        const extension = mediaPath.split('.').pop()?.toLowerCase() || 'png';
        const mimeType =
          extension === 'jpg' || extension === 'jpeg'
            ? 'image/jpeg'
            : extension === 'gif'
            ? 'image/gif'
            : extension === 'webp'
            ? 'image/webp'
            : 'image/png';

        images.push({
          pageNumber: pageNumber++,
          base64: imageData,
          mimeType,
          fileName,
        });
      } catch (err) {
        console.warn(`Failed to extract media: ${mediaPath}`, err);
      }
    }

    console.log(`Extracted ${images.length} images from PPTX`);
  } catch (error) {
    console.error('PPTX extraction failed:', error);
  }

  return images;
}
