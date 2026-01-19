/**
 * File extraction utilities for presentations (PDF/PPTX)
 * Extracts images from uploaded files for AI processing
 */

import type { ExtractedImage } from './types';

/**
 * Extract images from a presentation file (PDF or PPTX)
 */
export async function extractPresentationImages(
  file: File
): Promise<ExtractedImage[]> {
  const fileType = file.type;
  const fileName = file.name.toLowerCase();

  if (fileType === 'application/pdf' || fileName.endsWith('.pdf')) {
    return extractPdfImages(file);
  } else if (
    fileType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
    fileName.endsWith('.pptx')
  ) {
    return extractPptxImages(file);
  } else {
    throw new Error(`Unsupported file type: ${fileType || fileName}`);
  }
}

/**
 * Extract images from PDF file
 * Converts each page to an image for analysis
 */
async function extractPdfImages(file: File): Promise<ExtractedImage[]> {
  const images: ExtractedImage[] = [];

  try {
    // Convert File to ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();

    // Dynamic import for pdf-parse (server-side only)
    const pdfParse = await import('pdf-parse');
    const pdfData = await pdfParse.default(Buffer.from(arrayBuffer));

    // PDF-parse extracts text; for image analysis we need to render pages
    // For now, we'll use a canvas-based approach or fall back to page images
    // The actual rendering will happen via API endpoint

    // Return metadata for each page - actual rendering happens server-side
    const numPages = pdfData.numpages;

    for (let i = 0; i < numPages; i++) {
      images.push({
        pageNumber: i + 1,
        isSkipped: false,
        // These will be populated after server-side rendering
        url: undefined,
        base64: undefined,
        mimeType: 'image/png',
        width: 0,
        height: 0,
      });
    }

    return images;
  } catch (error) {
    console.error('PDF extraction failed:', error);
    throw new Error('Failed to extract images from PDF. Please try a different file.');
  }
}

/**
 * Extract images from PPTX file
 * Gets embedded images and slide backgrounds
 */
async function extractPptxImages(file: File): Promise<ExtractedImage[]> {
  const images: ExtractedImage[] = [];

  try {
    // Convert File to ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();

    // Dynamic import for officeparser
    const officeparser = await import('officeparser');

    // Extract content from PPTX
    const content = await officeparser.parseOfficeAsync(Buffer.from(arrayBuffer), {
      outputErrorToConsole: false,
    });

    // officeparser returns text content; we need to extract actual images
    // For embedded images, we need to parse the PPTX as a ZIP and extract media files
    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(arrayBuffer);

    // Find all media files in the PPTX
    const mediaFiles = Object.keys(zip.files).filter(
      name => name.startsWith('ppt/media/') &&
        (name.endsWith('.png') || name.endsWith('.jpg') || name.endsWith('.jpeg') || name.endsWith('.gif'))
    );

    // Extract each image
    let pageNumber = 1;
    for (const mediaPath of mediaFiles) {
      try {
        const imageData = await zip.files[mediaPath].async('base64');
        const extension = mediaPath.split('.').pop()?.toLowerCase() || 'png';
        const mimeType = extension === 'jpg' || extension === 'jpeg'
          ? 'image/jpeg'
          : `image/${extension}`;

        images.push({
          pageNumber: pageNumber++,
          isSkipped: false,
          base64: imageData,
          mimeType,
          width: 0, // Will be determined during analysis
          height: 0,
        });
      } catch (err) {
        console.warn(`Failed to extract media: ${mediaPath}`, err);
      }
    }

    // If no embedded images found, try to extract slide content as images
    // This would require rendering slides, which we'll do via API
    if (images.length === 0) {
      // Parse slides to count them
      const slideFiles = Object.keys(zip.files).filter(
        name => name.match(/ppt\/slides\/slide\d+\.xml/)
      );

      for (let i = 0; i < slideFiles.length; i++) {
        images.push({
          pageNumber: i + 1,
          isSkipped: false,
          url: undefined,
          base64: undefined,
          mimeType: 'image/png',
          width: 0,
          height: 0,
          needsRendering: true, // Flag for server-side rendering
        });
      }
    }

    return images;
  } catch (error) {
    console.error('PPTX extraction failed:', error);
    throw new Error('Failed to extract images from PPTX. Please try a different file.');
  }
}

/**
 * Convert a File to base64 data URL
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      // Remove the data URL prefix to get just the base64
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = error => reject(error);
  });
}

/**
 * Extract images from raw image files (jpg, png, etc.)
 */
export async function extractImageFile(file: File): Promise<ExtractedImage> {
  const base64 = await fileToBase64(file);

  return {
    pageNumber: 1,
    isSkipped: false,
    base64,
    mimeType: file.type,
    width: 0,
    height: 0,
  };
}

/**
 * Process multiple files and extract all images
 */
export async function extractFilesImages(
  files: File[]
): Promise<ExtractedImage[]> {
  const allImages: ExtractedImage[] = [];

  for (const file of files) {
    const fileType = file.type;
    const fileName = file.name.toLowerCase();

    if (fileType.startsWith('image/')) {
      // Direct image file
      const image = await extractImageFile(file);
      allImages.push(image);
    } else if (
      fileType === 'application/pdf' ||
      fileName.endsWith('.pdf') ||
      fileType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
      fileName.endsWith('.pptx')
    ) {
      // Presentation file
      const images = await extractPresentationImages(file);
      allImages.push(...images);
    } else {
      console.warn(`Skipping unsupported file type: ${fileType || fileName}`);
    }
  }

  return allImages;
}
