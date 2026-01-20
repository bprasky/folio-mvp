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

    // Track PDF documents that couldn't be converted to images
    // These will be analyzed directly using Claude's document API
    const pdfDocuments: Array<{
      url: string;
      pageCount: number;
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
        const images = await extractPdfImages(buffer, fileName, sessionId);

        if (images.length > 0) {
          allExtractedImages.push(...images);
        } else {
          // PDF extraction failed - store PDF info for direct Claude document analysis
          console.log(`PDF image extraction failed for ${fileName}, will use Claude document API`);

          // Get page count using pdf-lib
          try {
            const { PDFDocument } = await import('pdf-lib');
            const pdfDoc = await PDFDocument.load(buffer);
            const pageCount = pdfDoc.getPageCount();

            // Get public URL for the PDF
            const { data: pub } = supabaseAdmin.storage.from(IMPORTS_BUCKET).getPublicUrl(filePath);

            pdfDocuments.push({
              url: pub.publicUrl,
              pageCount,
              fileName,
            });

            console.log(`Stored PDF document: ${fileName} with ${pageCount} pages`);
          } catch (e) {
            console.error(`Failed to get PDF info for ${fileName}:`, e);
          }
        }
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

    // Calculate total pages (from images + PDF documents)
    const totalPdfPages = pdfDocuments.reduce((sum, doc) => sum + doc.pageCount, 0);
    const totalPages = allExtractedImages.length + totalPdfPages;

    // Update session with file info
    await prisma.importSession.update({
      where: { id: sessionId },
      data: {
        fileName: fileNames.join(', '),
        totalImages: storedImages.length || totalPdfPages, // Use PDF page count if no images
        processingMeta: {
          extractedImages: storedImages.length,
          totalPages,
          storedImages: storedImages.map(img => ({
            pageNumber: img.pageNumber,
            url: img.url,
          })),
          // Store PDF documents for direct Claude analysis
          pdfDocuments: pdfDocuments.length > 0 ? pdfDocuments : undefined,
        },
      },
    });

    return NextResponse.json({
      success: true,
      extractedImages: storedImages,
      pdfDocuments: pdfDocuments.length > 0 ? pdfDocuments : undefined,
      totalPages,
      storedCount: storedImages.length,
      pdfCount: pdfDocuments.length,
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
 * Extract images from PDF file by rendering each page
 * Uses Cloudinary for reliable serverless PDF-to-image conversion
 * Falls back to pdf-to-png-converter if Cloudinary is not configured
 */
async function extractPdfImages(
  buffer: Buffer,
  fileName: string,
  sessionId?: string
): Promise<Array<{ pageNumber: number; base64: string; mimeType: string; fileName: string }>> {
  const images: Array<{ pageNumber: number; base64: string; mimeType: string; fileName: string }> = [];

  // First, get page count using pdf-lib (reliable, no native deps)
  let pageCount = 0;
  try {
    const { PDFDocument } = await import('pdf-lib');
    const pdfDoc = await PDFDocument.load(buffer);
    pageCount = pdfDoc.getPageCount();
    console.log(`PDF "${fileName}" has ${pageCount} pages`);
  } catch (e) {
    console.error('Failed to parse PDF:', e);
    return images;
  }

  // Try Cloudinary if credentials are available
  const cloudinaryUrl = process.env.CLOUDINARY_URL;
  if (cloudinaryUrl) {
    try {
      console.log('Using Cloudinary for PDF conversion...');
      const cloudinaryImages = await extractPdfWithCloudinary(buffer, fileName, pageCount);
      if (cloudinaryImages.length > 0) {
        return cloudinaryImages;
      }
    } catch (error) {
      console.error('Cloudinary PDF conversion failed:', error);
    }
  }

  // Try pdf-to-png-converter (works in environments with native canvas support)
  try {
    console.log('Attempting pdf-to-png-converter...');
    const { pdfToPng } = await import('pdf-to-png-converter');

    const pngPages = await pdfToPng(new Uint8Array(buffer), {
      disableFontFace: true,
      useSystemFonts: true,
      viewportScale: 2.0,
    });

    console.log(`PDF rendered ${pngPages.length} pages`);

    for (let i = 0; i < pngPages.length; i++) {
      const page = pngPages[i];
      if (page.content) {
        images.push({
          pageNumber: page.pageNumber || (i + 1),
          base64: page.content.toString('base64'),
          mimeType: 'image/png',
          fileName,
        });
      }
    }

    if (images.length > 0) {
      console.log(`Successfully extracted ${images.length} images from PDF`);
      return images;
    }
  } catch (error) {
    console.error('pdf-to-png-converter failed (likely missing native canvas):', error);
  }

  // If we get here, we couldn't render the PDF
  console.error(`PDF conversion failed. Configure CLOUDINARY_URL for reliable serverless PDF rendering.`);
  console.error(`PDF has ${pageCount} pages but no rendering method available.`);

  return images;
}

/**
 * Extract PDF pages as images using Cloudinary
 * Cloudinary handles PDF-to-image conversion on their servers
 */
async function extractPdfWithCloudinary(
  buffer: Buffer,
  fileName: string,
  pageCount: number
): Promise<Array<{ pageNumber: number; base64: string; mimeType: string; fileName: string }>> {
  const images: Array<{ pageNumber: number; base64: string; mimeType: string; fileName: string }> = [];

  try {
    // Dynamic import to avoid build issues if not installed
    const cloudinary = await import('cloudinary');

    // Upload PDF to Cloudinary
    const uploadResult = await new Promise<{ public_id: string; secure_url: string }>((resolve, reject) => {
      const uploadStream = cloudinary.v2.uploader.upload_stream(
        {
          resource_type: 'raw',
          folder: 'pdf-imports',
          format: 'pdf',
        },
        (error, result) => {
          if (error) reject(error);
          else if (result) resolve(result);
          else reject(new Error('No result from Cloudinary'));
        }
      );
      uploadStream.end(buffer);
    });

    console.log(`PDF uploaded to Cloudinary: ${uploadResult.public_id}`);

    // Generate image URLs for each page and fetch them
    for (let page = 1; page <= pageCount; page++) {
      try {
        // Cloudinary transforms PDF pages to images using the pg_ parameter
        const imageUrl = cloudinary.v2.url(uploadResult.public_id, {
          resource_type: 'image',
          format: 'jpg',
          transformation: [
            { page: page },
            { width: 1200, crop: 'limit' },
            { quality: 'auto:good' },
          ],
        });

        // Fetch the image and convert to base64
        const response = await fetch(imageUrl);
        if (response.ok) {
          const arrayBuffer = await response.arrayBuffer();
          const base64 = Buffer.from(arrayBuffer).toString('base64');

          images.push({
            pageNumber: page,
            base64,
            mimeType: 'image/jpeg',
            fileName,
          });

          console.log(`Extracted page ${page}/${pageCount}`);
        }
      } catch (pageError) {
        console.error(`Failed to extract page ${page}:`, pageError);
      }
    }

    // Clean up: delete the PDF from Cloudinary
    try {
      await cloudinary.v2.uploader.destroy(uploadResult.public_id, { resource_type: 'raw' });
    } catch (e) {
      console.warn('Failed to cleanup Cloudinary PDF:', e);
    }
  } catch (error) {
    console.error('Cloudinary extraction failed:', error);
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
