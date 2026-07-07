/**
 * PDF Text Extraction Module
 * Extracts text with positional data and images from PDFs
 * Uses pdfjs-dist legacy build for Node.js compatibility
 */

console.log('[extractText.ts] Starting module load...');

// Use the legacy build for Node.js environments (no DOMMatrix dependency)
// @ts-ignore - Legacy build types
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs'

console.log('[extractText.ts] pdfjs-dist imported successfully');
import type { TextItem, TextMarkedContent } from 'pdfjs-dist/types/src/display/api'

// Disable worker in Node.js environment
pdfjsLib.GlobalWorkerOptions.workerSrc = ''

// Node's serverless runtime (Vercel) has no DOMMatrix / ImageData / Path2D,
// which pdfjs needs while parsing/rendering — without them it crashes with
// "DOMMatrix is not defined". Provide them from @napi-rs/canvas (already used by
// pdf-to-png-converter) rather than relying on pdfjs's own canvas auto-detection.
// Best-effort: if the native module isn't present, pdfjs degrades with a warning.
try {
  const g = globalThis as unknown as Record<string, unknown>;
  if (typeof g.DOMMatrix === 'undefined') {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const canvas = require('@napi-rs/canvas');
    if (canvas?.DOMMatrix) g.DOMMatrix = canvas.DOMMatrix;
    if (canvas?.ImageData) g.ImageData = canvas.ImageData;
    if (canvas?.Path2D) g.Path2D = canvas.Path2D;
    console.log('[extractText.ts] Installed DOMMatrix/ImageData/Path2D from @napi-rs/canvas');
  }
} catch (err) {
  console.warn('[extractText.ts] Could not load @napi-rs/canvas for DOM polyfills:', (err as Error)?.message);
}

export interface TextBlock {
  content: string
  bounds: {
    x: number
    y: number
    width: number
    height: number
  }
  page: number
  fontSize: number
  fontName: string
}

export interface ImageRegion {
  bounds: {
    x: number
    y: number
    width: number
    height: number
  }
  page: number
  imageIndex: number
  objectName?: string
}

export interface PDFExtractionResult {
  textBlocks: TextBlock[]
  imageRegions: ImageRegion[]
  pageCount: number
  pageDimensions: { width: number; height: number }[]
}

/**
 * Checks if a text content item is a TextItem (has string content)
 */
function isTextItem(item: TextItem | TextMarkedContent): item is TextItem {
  return 'str' in item && typeof item.str === 'string'
}

/**
 * Extracts text content with positional information from a PDF buffer
 */
export async function extractPDFContent(
  pdfBuffer: Buffer
): Promise<PDFExtractionResult> {
  // Convert buffer to Uint8Array for pdfjs
  const data = new Uint8Array(pdfBuffer)

  // Load the PDF document
  const loadingTask = pdfjsLib.getDocument({
    data,
    useSystemFonts: true,
    disableFontFace: true,
  })

  const pdfDoc = await loadingTask.promise
  const pageCount = pdfDoc.numPages

  const textBlocks: TextBlock[] = []
  const imageRegions: ImageRegion[] = []
  const pageDimensions: { width: number; height: number }[] = []

  // Process each page
  for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
    const page = await pdfDoc.getPage(pageNum)
    const viewport = page.getViewport({ scale: 1.0 })

    pageDimensions.push({
      width: viewport.width,
      height: viewport.height
    })

    // Extract text content
    const textContent = await page.getTextContent()

    for (const item of textContent.items) {
      if (!isTextItem(item) || !item.str.trim()) {
        continue
      }

      // Transform coordinates from PDF space to page space
      // PDF coordinates: origin at bottom-left
      // We transform to top-left origin for easier UI work
      const transform = item.transform
      const x = transform[4]
      const y = viewport.height - transform[5] // Flip Y coordinate
      const fontSize = Math.sqrt(transform[0] * transform[0] + transform[1] * transform[1])

      // Estimate width based on string length and font size
      const width = item.width || (item.str.length * fontSize * 0.5)
      const height = item.height || fontSize

      textBlocks.push({
        content: item.str,
        bounds: {
          x,
          y: y - height, // Adjust for height since we flipped Y
          width,
          height
        },
        page: pageNum,
        fontSize,
        fontName: item.fontName || 'unknown'
      })
    }

    // Extract image regions from operators
    try {
      const operatorList = await page.getOperatorList()
      let imageIndex = 0

      for (let i = 0; i < operatorList.fnArray.length; i++) {
        const fn = operatorList.fnArray[i]

        // OPS.paintImageXObject = 85, OPS.paintInlineImageXObject = 86
        if (fn === 85 || fn === 86) {
          const args = operatorList.argsArray[i]
          const objectName = args?.[0] as string | undefined

          // Try to get image dimensions from the object
          // This is an approximation - actual image bounds depend on the transform matrix
          try {
            const objs = page.objs
            const imgData = objs.get(objectName || '') as { width?: number; height?: number } | null

            // Use default bounds if we can't get exact dimensions
            // The image placement depends on the current transform matrix
            // For simplicity, we'll mark the page region
            const imgWidth = imgData?.width || 100
            const imgHeight = imgData?.height || 100

            imageRegions.push({
              bounds: {
                x: 0,
                y: 0,
                width: imgWidth,
                height: imgHeight
              },
              page: pageNum,
              imageIndex: imageIndex++,
              objectName
            })
          } catch {
            // If we can't get the image data, still record its existence
            imageRegions.push({
              bounds: {
                x: 0,
                y: 0,
                width: viewport.width,
                height: viewport.height
              },
              page: pageNum,
              imageIndex: imageIndex++,
              objectName
            })
          }
        }
      }
    } catch (err) {
      console.warn(`Failed to extract images from page ${pageNum}:`, err)
    }
  }

  return {
    textBlocks,
    imageRegions,
    pageCount,
    pageDimensions
  }
}

/**
 * Extracts a specific image from a PDF as a base64-encoded PNG
 * This is a placeholder - actual image extraction requires more complex handling
 */
export async function extractImageFromPDF(
  pdfBuffer: Buffer,
  imageRegion: ImageRegion
): Promise<string | null> {
  try {
    // For now, we'll use pdf-to-png-converter for full page rendering
    // and then crop the image region
    // This is a simplified approach - in production, you might want to
    // extract the actual image XObject data

    const { pdfToPng } = await import('pdf-to-png-converter')

    const pngPages = await pdfToPng(pdfBuffer, {
      pagesToProcess: [imageRegion.page],
      viewportScale: 2.0 // Higher resolution for better quality
    })

    if (pngPages.length > 0 && pngPages[0].content) {
      // Return the full page as base64 for now
      // In a more sophisticated implementation, you would crop to the bounds
      return pngPages[0].content.toString('base64')
    }

    return null
  } catch (err) {
    console.error('Failed to extract image from PDF:', err)
    return null
  }
}

/**
 * Renders a PDF page to a base64-encoded PNG
 */
export async function renderPDFPage(
  pdfBuffer: Buffer,
  pageNumber: number,
  scale: number = 2.0
): Promise<string | null> {
  try {
    const { pdfToPng } = await import('pdf-to-png-converter')

    const pngPages = await pdfToPng(pdfBuffer, {
      pagesToProcess: [pageNumber],
      viewportScale: scale
    })

    if (pngPages.length > 0 && pngPages[0].content) {
      return pngPages[0].content.toString('base64')
    }

    return null
  } catch (err) {
    console.error('Failed to render PDF page:', err)
    return null
  }
}

/**
 * Simple interface for text blocks used by the extraction pipeline
 */
export interface SimpleTextBlock {
  text: string
  page: number
  x: number
  y: number
  fontSize: number
}

/**
 * Extracts text blocks from a PDF buffer
 * Returns an array of simple text blocks for spec extraction
 */
export async function extractTextFromPdfBuffer(
  pdfBuffer: Buffer
): Promise<SimpleTextBlock[]> {
  try {
    const result = await extractPDFContent(pdfBuffer)

    return result.textBlocks.map(block => ({
      text: block.content,
      page: block.page,
      x: block.bounds.x,
      y: block.bounds.y,
      fontSize: block.fontSize
    }))
  } catch (err) {
    console.error('Failed to extract text from PDF:', err)
    return []
  }
}

/**
 * Groups text blocks by page number
 */
export function clusterTextByPage(
  textBlocks: SimpleTextBlock[]
): Map<number, SimpleTextBlock[]> {
  const pageMap = new Map<number, SimpleTextBlock[]>()

  for (const block of textBlocks) {
    const page = block.page
    if (!pageMap.has(page)) {
      pageMap.set(page, [])
    }
    pageMap.get(page)!.push(block)
  }

  return pageMap
}
