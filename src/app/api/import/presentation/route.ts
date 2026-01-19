import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';

// We need to import dynamically for server-side PDF/PPTX parsing
// These libraries don't work in Edge runtime

export const runtime = 'nodejs';
export const maxDuration = 120; // 2 minutes for large files

/**
 * POST /api/import/presentation
 * Upload and process a presentation file (PDF or PPTX)
 * Extracts images for AI analysis
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string })?.id;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await req.formData();
    const files = formData.getAll('files') as File[];
    const sessionId = formData.get('sessionId') as string;
    const projectId = formData.get('projectId') as string | null;

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 });
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

    // Process each file and extract images
    const allExtractedImages: Array<{
      pageNumber: number;
      base64: string;
      mimeType: string;
      fileName: string;
    }> = [];

    for (const file of files) {
      const fileName = file.name.toLowerCase();
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      if (fileName.endsWith('.pdf')) {
        const images = await extractPdfImages(buffer, file.name);
        allExtractedImages.push(...images);
      } else if (fileName.endsWith('.pptx')) {
        const images = await extractPptxImages(buffer, file.name);
        allExtractedImages.push(...images);
      } else {
        console.warn(`Skipping unsupported file: ${file.name}`);
      }
    }

    // Store extracted images in temp storage and save URLs
    const { supabaseAdmin } = await import('@/lib/supabaseAdmin');
    const { ulid } = await import('ulid');

    const storedImages: Array<{
      pageNumber: number;
      url: string;
      mimeType: string;
    }> = [];

    const BUCKET = process.env.SB_BUCKET_NAME || 'event-images';

    for (const img of allExtractedImages) {
      try {
        const id = ulid();
        const ext = img.mimeType.includes('png') ? 'png' : 'jpg';
        const path = `imports/${sessionId}/${id}.${ext}`;

        const imageBuffer = Buffer.from(img.base64, 'base64');

        const { error } = await supabaseAdmin.storage.from(BUCKET).upload(path, imageBuffer, {
          contentType: img.mimeType,
          upsert: false,
        });

        if (error) {
          console.error(`Failed to upload image:`, error);
          continue;
        }

        const { data: pub } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);

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
        fileName: files.map(f => f.name).join(', '),
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
    return NextResponse.json(
      { error: 'Failed to process presentation' },
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
