console.log('[process.ts] Starting module load...');

import { prisma } from '@/lib/prisma';
import { analyzeImage, shouldAnalyzeImage, analyzePdfDocument } from './analyze';
import { searchProductAttribution } from './attribute';
import type { ExtractedImage, ProcessingResult, RoomAnalysis, ProductAttribution, PdfDocument } from './types';
// Lazy import PDF extraction to avoid blocking module load if pdfjs-dist fails
// import { extractTextFromPdfBuffer, clusterTextByPage } from '@/lib/pdf/extractText';
// import { SPEC_PATTERNS } from '@/lib/pdf/patterns';

console.log('[process.ts] Core imports successful');

// Dynamic imports for PDF text extraction (may fail in some environments)
let extractTextFromPdfBuffer: ((buffer: Buffer) => Promise<Array<{text: string; page: number; x: number; y: number; fontSize: number}>>) | null = null;
let clusterTextByPage: ((blocks: Array<{text: string; page: number; x: number; y: number; fontSize: number}>) => Map<number, Array<{text: string; page: number; x: number; y: number; fontSize: number}>>) | null = null;
let SPEC_PATTERNS: { knownVendors: string[]; price: RegExp; dimensionsLWH: RegExp; dimensionsInches: RegExp; dimensionsSimple: RegExp; sku: RegExp } | null = null;

async function loadPdfExtraction() {
  if (extractTextFromPdfBuffer && clusterTextByPage && SPEC_PATTERNS) {
    return true;
  }
  try {
    console.log('[process.ts] Loading PDF extraction modules...');
    const extractModule = await import('@/lib/pdf/extractText');
    const patternsModule = await import('@/lib/pdf/patterns');
    extractTextFromPdfBuffer = extractModule.extractTextFromPdfBuffer;
    clusterTextByPage = extractModule.clusterTextByPage;
    SPEC_PATTERNS = patternsModule.SPEC_PATTERNS;
    console.log('[process.ts] PDF extraction modules loaded successfully');
    return true;
  } catch (err) {
    console.error('[process.ts] Failed to load PDF extraction modules:', err);
    return false;
  }
}

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

      // Update progress (merge with existing to preserve PDF URLs)
      await prisma.importSession.update({
        where: { id: sessionId },
        data: {
          processingMeta: {
            ...(await getExistingMeta(sessionId)),
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

    // Update session to ready for review (merge with existing meta to preserve PDF URLs)
    await prisma.importSession.update({
      where: { id: sessionId },
      data: {
        status: 'READY_FOR_REVIEW',
        totalProducts: result.totalProducts,
        processingMeta: {
          ...(await getExistingMeta(sessionId)),
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
 * Helper to get existing processingMeta from a session
 */
async function getExistingMeta(sessionId: string): Promise<Record<string, unknown>> {
  const session = await prisma.importSession.findUnique({
    where: { id: sessionId },
    select: { processingMeta: true },
  });
  return (session?.processingMeta as Record<string, unknown>) || {};
}

/**
 * Extract spec data from PDF text blocks for each page
 * Returns a map of page number -> extracted specs
 */
interface ExtractedPageSpecs {
  vendors: string[];
  prices: number[];
  dimensions: string[];
  skus: string[];
  materials: string[];
  urls: string[];
  rawText: string[];
}

async function extractSpecsFromPdf(
  pdfUrl: string
): Promise<Map<number, ExtractedPageSpecs>> {
  const pageSpecs = new Map<number, ExtractedPageSpecs>();

  try {
    // Fetch PDF from URL
    console.log('[extractSpecsFromPdf] Fetching PDF for text extraction...');
    const response = await fetch(pdfUrl);
    if (!response.ok) {
      console.error(`[extractSpecsFromPdf] Failed to fetch PDF: ${response.status}`);
      return pageSpecs;
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Use pdf-parse with timeout (can hang in serverless environments)
    console.log('[extractSpecsFromPdf] Parsing PDF with pdf-parse...');
    let pdfData;
    try {
      const pdfParse = (await import('pdf-parse')).default;

      // Add timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('PDF parse timeout after 15s')), 15000)
      );

      pdfData = await Promise.race([
        pdfParse(buffer),
        timeoutPromise
      ]) as { text: string; numpages: number };

      console.log(`[extractSpecsFromPdf] Extracted ${pdfData.text.length} characters from PDF, ${pdfData.numpages} pages`);
    } catch (parseErr) {
      console.error('[extractSpecsFromPdf] pdf-parse failed:', parseErr);
      return pageSpecs;
    }

    if (!pdfData.text || pdfData.text.length === 0) {
      console.log('[extractSpecsFromPdf] No text found in PDF');
      return pageSpecs;
    }

    // Load patterns for extraction
    const loaded = await loadPdfExtraction();
    if (!loaded || !SPEC_PATTERNS) {
      console.log('[extractSpecsFromPdf] Patterns not available, using built-in patterns');
    }

    // Define fallback patterns if SPEC_PATTERNS isn't available
    const patterns = SPEC_PATTERNS || {
      knownVendors: [
        'RH', 'Restoration Hardware', 'Pottery Barn', 'West Elm', 'CB2', 'Crate & Barrel',
        'Design Within Reach', 'DWR', 'Article', 'Wayfair', 'Arhaus', 'Serena & Lily',
        'Anthropologie', 'Room & Board', 'Mitchell Gold', 'Ethan Allen', 'Williams Sonoma',
        'Four Hands', 'Uttermost', 'Arteriors', 'Visual Comfort', 'Hudson Valley', 'Circa',
        'Kelly Wearstler', 'Noir', 'Currey', 'Regina Andrew', 'Gabby', 'Made Goods'
      ],
      price: /\$\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/g,
      dimensionsLWH: /(\d+(?:\.\d+)?)\s*["']?\s*[Ww]?\s*[xX×]\s*(\d+(?:\.\d+)?)\s*["']?\s*[DdLl]?\s*[xX×]\s*(\d+(?:\.\d+)?)\s*["']?\s*[Hh]?/g,
      dimensionsInches: /(\d+(?:\.\d+)?)\s*(?:"|in|inch(?:es)?)\s*[xX×]\s*(\d+(?:\.\d+)?)\s*(?:"|in|inch(?:es)?)/gi,
      dimensionsSimple: /(\d+)\s*[xX×]\s*(\d+)\s*[xX×]\s*(\d+)/g,
      sku: /(?:SKU|Model|Item|Style)[:\s#]*([A-Z0-9-]+)/gi
    };

    // Since pdf-parse doesn't give per-page text easily, we'll extract specs from the entire PDF
    // and assign them to page 1 (the process.ts logic will distribute to detected products)
    const fullText = pdfData.text;
    const lines = fullText.split(/\n+/).filter((line: string) => line.trim());

    const specs: ExtractedPageSpecs = {
      vendors: [],
      prices: [],
      dimensions: [],
      skus: [],
      materials: [],
      urls: [],
      rawText: [],
    };

    console.log(`[extractSpecsFromPdf] Processing ${lines.length} lines of text`);

    for (const line of lines) {
      const text = line.trim();
      if (!text) continue;

      specs.rawText.push(text);

      // Check for known vendors
      for (const vendor of patterns.knownVendors) {
        if (text.toLowerCase().includes(vendor.toLowerCase())) {
          if (!specs.vendors.includes(vendor)) {
            specs.vendors.push(vendor);
            console.log(`[extractSpecsFromPdf] Found vendor: ${vendor}`);
          }
        }
      }

      // Extract prices (use matchAll for global regex)
      const priceRegex = /\$\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/g;
      let priceMatch;
      while ((priceMatch = priceRegex.exec(text)) !== null) {
        const priceStr = priceMatch[1].replace(/,/g, '');
        const price = Math.round(parseFloat(priceStr) * 100);
        if (price > 0 && !specs.prices.includes(price)) {
          specs.prices.push(price);
          console.log(`[extractSpecsFromPdf] Found price: $${price / 100}`);
        }
      }

      // Extract dimensions (try multiple patterns)
      const dimsMatch = text.match(/(\d+(?:\.\d+)?)\s*["']?\s*[Ww]?\s*[xX×]\s*(\d+(?:\.\d+)?)\s*["']?\s*[DdLl]?\s*[xX×]\s*(\d+(?:\.\d+)?)\s*["']?\s*[Hh]?/) ||
                        text.match(/(\d+(?:\.\d+)?)\s*(?:"|in|inch(?:es)?)\s*[xX×]\s*(\d+(?:\.\d+)?)\s*(?:"|in|inch(?:es)?)/i) ||
                        text.match(/(\d+)\s*[xX×]\s*(\d+)\s*[xX×]\s*(\d+)/);
      if (dimsMatch) {
        const dimsStr = dimsMatch[0];
        if (!specs.dimensions.includes(dimsStr)) {
          specs.dimensions.push(dimsStr);
          console.log(`[extractSpecsFromPdf] Found dimensions: ${dimsStr}`);
        }
      }

      // Extract SKU
      const skuMatch = text.match(/(?:SKU|Model|Item|Style)[:\s#]*([A-Z0-9-]+)/i);
      if (skuMatch) {
        const sku = skuMatch[1] || skuMatch[0];
        if (!specs.skus.includes(sku)) {
          specs.skus.push(sku);
          console.log(`[extractSpecsFromPdf] Found SKU: ${sku}`);
        }
      }

      // Check for material keywords
      const materialKeywords = ['wood', 'leather', 'velvet', 'linen', 'cotton', 'marble', 'brass', 'steel', 'oak', 'walnut', 'fabric', 'metal', 'glass', 'ceramic', 'porcelain', 'iron', 'bronze', 'nickel', 'chrome'];
      for (const mat of materialKeywords) {
        if (text.toLowerCase().includes(mat) && !specs.materials.includes(mat)) {
          specs.materials.push(mat);
        }
      }

      // Extract URLs
      const urlMatch = text.match(/https?:\/\/[^\s]+/gi);
      if (urlMatch) {
        for (const url of urlMatch) {
          if (!specs.urls.includes(url)) {
            specs.urls.push(url);
          }
        }
      }
    }

    // Store specs for all pages (we'll distribute to products based on page number)
    // Since pdf-parse doesn't give per-page text, assign to each page
    if (specs.vendors.length > 0 || specs.prices.length > 0 || specs.dimensions.length > 0) {
      for (let pageNum = 1; pageNum <= pdfData.numpages; pageNum++) {
        pageSpecs.set(pageNum, specs);
      }
      console.log(`[extractSpecsFromPdf] Found ${specs.vendors.length} vendors, ${specs.prices.length} prices, ${specs.dimensions.length} dimensions, ${specs.materials.length} materials`);
    } else {
      console.log('[extractSpecsFromPdf] No spec data found in PDF text');
    }

    console.log(`[extractSpecsFromPdf] Extracted specs applied to ${pageSpecs.size} pages`);
  } catch (error) {
    console.error('Error extracting specs from PDF:', error);
  }

  return pageSpecs;
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
      // Extracted spec fields
      extractedVendor?: string | null;
      extractedPrice?: number | null;
      extractedDimensions?: string | null;
      extractedSku?: string | null;
      extractedMaterial?: string | null;
      extractedProductUrl?: string | null;
    }> = [];

    // Process each PDF document
    for (const pdfDoc of pdfDocuments) {
      console.log(`[processImportPdf] Analyzing PDF: ${pdfDoc.fileName} (${pdfDoc.pageCount} pages)`);

      try {
        // Run text extraction and visual analysis in parallel
        // Text extraction is optional - if it fails, we continue with visual-only
        console.log('[processImportPdf] Starting parallel analysis (text + visual)...');

        const textExtractionPromise = extractSpecsFromPdf(pdfDoc.url)
          .then(specs => {
            console.log(`[processImportPdf] Text extraction completed: ${specs.size} pages with specs`);
            return { specs, error: null };
          })
          .catch(err => {
            console.error('[processImportPdf] Text extraction failed (continuing with visual only):', err);
            return { specs: new Map<number, ExtractedPageSpecs>(), error: err?.message || 'Unknown error' };
          });

        const visualAnalysisPromise = analyzePdfDocument(pdfDoc.url);

        // Wait for both, but text extraction failure won't block
        const [textResult, analysis] = await Promise.all([
          textExtractionPromise,
          visualAnalysisPromise
        ]);

        const pageSpecs = textResult.specs;
        const extractionError = textResult.error;

        // Count visual extractions from Claude's analysis
        const visualExtractionStats = {
          pagesWithVisualSpecs: analysis.pages.filter(p =>
            p.extractedSpecs?.vendors?.length ||
            p.extractedSpecs?.prices?.length ||
            p.products.some(prod => prod.extractedVendor || prod.extractedPrice)
          ).length,
          productsWithVisualSpecs: analysis.pages.flatMap(p => p.products).filter(
            prod => prod.extractedVendor || prod.extractedPrice || prod.extractedDimensions
          ).length,
          sampleVisualSpecs: analysis.pages.length > 0 ? {
            pageSpecs: analysis.pages[0].extractedSpecs,
            productSpecs: analysis.pages[0].products[0] ? {
              vendor: analysis.pages[0].products[0].extractedVendor,
              price: analysis.pages[0].products[0].extractedPrice,
              dims: analysis.pages[0].products[0].extractedDimensions,
            } : null
          } : null
        };

        // Log extraction results for debugging
        const extractionDebug = {
          pdfParse: {
            pagesWithSpecs: pageSpecs.size,
            extractionError,
            sampleSpecs: pageSpecs.size > 0 ? Object.fromEntries([...pageSpecs.entries()].slice(0, 1).map(([k, v]) => [k, {
              vendors: v.vendors,
              prices: v.prices,
              dimensions: v.dimensions
            }])) : null
          },
          visualExtraction: visualExtractionStats
        };
        console.log('[processImportPdf] Extraction debug:', JSON.stringify(extractionDebug));

        // Save extraction debug to session meta
        await prisma.importSession.update({
          where: { id: sessionId },
          data: {
            processingMeta: {
              ...(await getExistingMeta(sessionId)),
              extractionDebug,
            },
          },
        });

        console.log(`[processImportPdf] Got specs from ${pageSpecs.size} pages`);
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

          // Get extracted specs from pdf-parse for this page (fallback)
          const pdfParseSpecs = pageSpecs.get(pageAnalysis.pageNumber);
          // Get visual-extracted specs from Claude's analysis for this page
          const visualPageSpecs = pageAnalysis.extractedSpecs;
          const productsOnPage = pageAnalysis.products.length;

          for (let idx = 0; idx < pageAnalysis.products.length; idx++) {
            const product = pageAnalysis.products[idx];

            // Determine which extracted specs to assign to this product
            // Priority: 1) Product-level visual extraction, 2) Page-level visual extraction, 3) PDF-parse extraction
            let extractedVendor: string | null = null;
            let extractedPrice: number | null = null;
            let extractedDimensions: string | null = null;
            let extractedSku: string | null = null;
            let extractedMaterial: string | null = null;
            let extractedProductUrl: string | null = null;
            let extractedProductName: string | null = null;

            // 1. First check if the product itself has visual-extracted specs (from Claude)
            if (product.extractedVendor) {
              extractedVendor = product.extractedVendor;
            }
            if (product.extractedPrice) {
              // Parse price string to cents (e.g., "$1,299" -> 129900)
              const priceStr = product.extractedPrice.replace(/[^0-9.]/g, '');
              const priceNum = parseFloat(priceStr);
              if (!isNaN(priceNum)) {
                extractedPrice = Math.round(priceNum * 100);
              }
            }
            if (product.extractedDimensions) {
              extractedDimensions = product.extractedDimensions;
            }
            if (product.extractedSku) {
              extractedSku = product.extractedSku;
            }
            if (product.extractedProductName) {
              extractedProductName = product.extractedProductName;
            }

            // 2. Fall back to page-level visual extraction (from Claude)
            if (!extractedVendor && visualPageSpecs?.vendors?.length) {
              if (productsOnPage === 1) {
                extractedVendor = visualPageSpecs.vendors[0];
              } else {
                extractedVendor = visualPageSpecs.vendors[idx] || visualPageSpecs.vendors[0];
              }
            }
            if (!extractedPrice && visualPageSpecs?.prices?.length) {
              const priceStr = productsOnPage === 1
                ? visualPageSpecs.prices[0]
                : (visualPageSpecs.prices[idx] || (idx === 0 ? visualPageSpecs.prices[0] : null));
              if (priceStr) {
                const priceNum = parseFloat(priceStr.replace(/[^0-9.]/g, ''));
                if (!isNaN(priceNum)) {
                  extractedPrice = Math.round(priceNum * 100);
                }
              }
            }
            if (!extractedDimensions && visualPageSpecs?.dimensions?.length) {
              extractedDimensions = productsOnPage === 1
                ? visualPageSpecs.dimensions[0]
                : (visualPageSpecs.dimensions[idx] || (idx === 0 ? visualPageSpecs.dimensions[0] : null));
            }
            if (!extractedSku && visualPageSpecs?.skus?.length) {
              extractedSku = visualPageSpecs.skus[idx] || null;
            }
            if (!extractedProductName && visualPageSpecs?.productNames?.length) {
              extractedProductName = productsOnPage === 1
                ? visualPageSpecs.productNames[0]
                : (visualPageSpecs.productNames[idx] || null);
            }

            // 3. Fall back to pdf-parse extraction (if available)
            if (pdfParseSpecs) {
              if (!extractedVendor) {
                extractedVendor = productsOnPage === 1
                  ? pdfParseSpecs.vendors[0] || null
                  : (pdfParseSpecs.vendors[idx] || pdfParseSpecs.vendors[0] || null);
              }
              if (!extractedPrice && pdfParseSpecs.prices.length > 0) {
                extractedPrice = productsOnPage === 1
                  ? pdfParseSpecs.prices[0]
                  : (pdfParseSpecs.prices[idx] || (idx === 0 ? pdfParseSpecs.prices[0] : null));
              }
              if (!extractedDimensions) {
                extractedDimensions = productsOnPage === 1
                  ? pdfParseSpecs.dimensions[0] || null
                  : (pdfParseSpecs.dimensions[idx] || (idx === 0 ? pdfParseSpecs.dimensions[0] : null));
              }
              if (!extractedSku) {
                extractedSku = pdfParseSpecs.skus[idx] || null;
              }
              if (!extractedMaterial && pdfParseSpecs.materials.length > 0) {
                extractedMaterial = pdfParseSpecs.materials.join(', ');
              }
              if (!extractedProductUrl && pdfParseSpecs.urls.length > 0) {
                extractedProductUrl = pdfParseSpecs.urls[idx] || pdfParseSpecs.urls[0] || null;
              }
            }

            // Determine confidence based on extracted data
            // High: has vendor AND price
            // Medium: has vendor OR price
            // Low: no extracted spec data (visual only)
            let confidence = product.confidence;
            if (extractedVendor && extractedPrice) {
              confidence = 'high';
            } else if (extractedVendor || extractedPrice || extractedDimensions) {
              confidence = 'medium';
            }
            // Keep original confidence if no text data was found

            // Build enhanced search query with extracted data
            let enhancedSearchQuery = product.searchQuery;
            if (extractedVendor || extractedProductName) {
              const parts = [extractedVendor, extractedProductName, product.searchQuery].filter(Boolean);
              enhancedSearchQuery = parts.join(' ').trim();
            }

            // Build enhanced description with product name if available
            const enhancedDescription = extractedProductName
              ? `${extractedProductName} - ${product.description}`
              : product.description;

            allPendingTags.push({
              importSessionId: sessionId,
              tempImageUrl: pageImageUrl, // Use Cloudinary page image URL
              projectImageId: null,
              x: product.position.x,
              y: product.position.y,
              description: enhancedDescription,
              category: product.category,
              searchQuery: enhancedSearchQuery,
              suggestions: [],
              topSuggestion: null,
              detectionConfidence: confidence,
              attributionConfidence: null,
              status: 'UNREVIEWED' as const,
              pageNumber: pageAnalysis.pageNumber,
              roomType: pageAnalysis.roomType,
              // Include extracted spec data
              extractedVendor,
              extractedPrice,
              extractedDimensions,
              extractedSku,
              extractedMaterial,
              extractedProductUrl,
            });
          }
        }

        // Update progress (merge with existing to preserve PDF URLs)
        await prisma.importSession.update({
          where: { id: sessionId },
          data: {
            processingMeta: {
              ...(await getExistingMeta(sessionId)),
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
          // Include extracted spec fields
          extractedVendor: tag.extractedVendor,
          extractedPrice: tag.extractedPrice,
          extractedDimensions: tag.extractedDimensions,
          extractedSku: tag.extractedSku,
          extractedMaterial: tag.extractedMaterial,
          extractedProductUrl: tag.extractedProductUrl,
        })),
      });
      result.pendingTagsCreated = allPendingTags.length;
    }

    // Update session to ready for review (merge with existing meta to preserve PDF URLs)
    const existingMeta = await getExistingMeta(sessionId);
    await prisma.importSession.update({
      where: { id: sessionId },
      data: {
        status: 'READY_FOR_REVIEW',
        totalProducts: result.totalProducts,
        processingMeta: {
          ...existingMeta,
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
