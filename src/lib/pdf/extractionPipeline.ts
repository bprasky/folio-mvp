/**
 * Main PDF Extraction Pipeline
 * Orchestrates the full extraction process from PDF to structured items
 */

import { extractPDFContent, extractImageFromPDF, renderPDFPage } from './extractText'
import { parseTextCluster } from './patterns'
import { clusterTextBlocks, associateClustersWithImages, filterProductClusters } from './clustering'
import {
  ExtractedItem,
  createExtractedItem,
  groupByConfidence,
  calculateStats
} from './confidence'
import { generateInspirationSearchQuery, analyzePageImage } from './aiEnhancement'

export interface ExtractionOptions {
  generateImageSearchQueries?: boolean  // default: true
  maxItemsPerPage?: number              // default: 20
  useVisualAnalysis?: boolean           // default: true - use AI to find products in page images
  clusteringThresholds?: {
    maxVerticalGap?: number             // default: 30
    maxHorizontalGap?: number           // default: 100
  }
  associationDistance?: number          // default: 200
}

const DEFAULT_OPTIONS: Required<ExtractionOptions> = {
  generateImageSearchQueries: true,
  maxItemsPerPage: 20,
  useVisualAnalysis: true,
  clusteringThresholds: {
    maxVerticalGap: 30,
    maxHorizontalGap: 100
  },
  associationDistance: 200
}

export interface ExtractionResult {
  items: {
    high: ExtractedItem[]
    medium: ExtractedItem[]
    low: ExtractedItem[]
  }
  stats: {
    totalImages: number
    specificationsFound: number
    inspirationImages: number
    pagesProcessed: number
    fieldsExtracted: number
    fieldsMissing: number
  }
  processingTime: number
}

/**
 * Generates a unique ID using crypto
 */
function generateId(): string {
  return crypto.randomUUID()
}

/**
 * Main extraction function - processes a PDF and returns structured items
 */
export async function extractSpecificationsFromPDF(
  pdfBuffer: Buffer,
  options?: ExtractionOptions
): Promise<ExtractionResult> {
  const startTime = Date.now()
  const opts = { ...DEFAULT_OPTIONS, ...options }

  // Step 1: Extract raw content from PDF
  console.log('Step 1: Extracting PDF content...')
  const pdfContent = await extractPDFContent(pdfBuffer)
  console.log(`  Found ${pdfContent.textBlocks.length} text blocks, ${pdfContent.imageRegions.length} images across ${pdfContent.pageCount} pages`)

  // Step 2: Cluster text blocks
  console.log('Step 2: Clustering text blocks...')
  const textClusters = clusterTextBlocks(pdfContent.textBlocks, opts.clusteringThresholds)
  console.log(`  Created ${textClusters.length} text clusters`)

  // Filter to likely product clusters
  const productClusters = filterProductClusters(textClusters)
  console.log(`  ${productClusters.length} clusters contain product information`)

  // Step 3: Associate clusters with images
  console.log('Step 3: Associating clusters with images...')
  const associations = associateClustersWithImages(
    productClusters,
    pdfContent.imageRegions,
    { maxDistance: opts.associationDistance, preferredDirection: 'any' }
  )
  console.log(`  Created ${associations.length} item associations`)

  // Step 4: Process each association into an ExtractedItem
  console.log('Step 4: Processing associations into items...')
  const items: ExtractedItem[] = []

  for (const assoc of associations) {
    const spec = assoc.specification

    // Extract image data if present
    let imageData: string | null = null
    if (assoc.image) {
      imageData = await extractImageFromPDF(pdfBuffer, assoc.image)
    }

    const item = createExtractedItem(generateId(), {
      productName: spec.productName,
      brand: spec.brand,
      vendor: spec.brand, // Default vendor to brand
      sku: spec.sku,
      price: spec.price,
      currency: spec.currency,
      dimensions: spec.dimensions,
      material: spec.material,
      finish: spec.finish,
      description: null,
      productUrl: spec.productUrl,
      quantity: spec.quantity,
      imageData,
      imageBounds: assoc.image?.bounds || null,
      sourceText: assoc.textCluster?.blocks.map(b => b.content) || [],
      page: assoc.page
    })

    items.push(item)
  }

  // Step 5: Use visual analysis to find additional products (optional)
  if (opts.useVisualAnalysis && items.length < opts.maxItemsPerPage * pdfContent.pageCount) {
    console.log('Step 5: Running visual analysis on pages...')

    for (let pageNum = 1; pageNum <= pdfContent.pageCount; pageNum++) {
      const pageItems = items.filter(i => i.page === pageNum)

      // Skip if we already have enough items for this page
      if (pageItems.length >= opts.maxItemsPerPage) continue

      // Render page and analyze
      const pageImage = await renderPDFPage(pdfBuffer, pageNum)
      if (pageImage) {
        try {
          const analysis = await analyzePageImage(pageImage, pageItems)

          for (const product of analysis.products) {
            // Skip if we've hit the limit
            if (items.filter(i => i.page === pageNum).length >= opts.maxItemsPerPage) break

            // Create an item from the visual analysis
            const item = createExtractedItem(generateId(), {
              productName: product.description,
              brand: null,
              vendor: null,
              sku: null,
              price: null,
              currency: 'USD',
              dimensions: null,
              material: null,
              finish: null,
              description: product.description,
              productUrl: null,
              quantity: null,
              imageData: pageImage, // Use full page image
              imageBounds: {
                x: product.estimatedBounds.x,
                y: product.estimatedBounds.y,
                width: product.estimatedBounds.width,
                height: product.estimatedBounds.height
              },
              sourceText: [],
              page: pageNum
            })

            items.push(item)
          }
        } catch (err) {
          console.warn(`Visual analysis failed for page ${pageNum}:`, err)
        }
      }
    }
  }

  // Step 6: Generate search queries for inspiration items
  if (opts.generateImageSearchQueries) {
    console.log('Step 6: Generating search queries for inspiration items...')

    for (const item of items) {
      if (item.type === 'inspiration' && item.imageData && !item.searchQuery) {
        try {
          const query = await generateInspirationSearchQuery(item.imageData)
          item.searchQuery = query
          item.description = query
        } catch (err) {
          console.warn(`Failed to generate search query for item ${item.id}:`, err)
        }
      }
    }
  }

  // Step 7: Group by confidence and calculate stats
  console.log('Step 7: Grouping results and calculating stats...')
  const grouped = groupByConfidence(items)
  const stats = calculateStats(items)

  const processingTime = Date.now() - startTime
  console.log(`Extraction complete in ${processingTime}ms`)

  return {
    items: grouped,
    stats: {
      totalImages: stats.totalImages,
      specificationsFound: stats.specificationsFound,
      inspirationImages: stats.inspirationImages,
      pagesProcessed: pdfContent.pageCount,
      fieldsExtracted: stats.filledFields,
      fieldsMissing: stats.totalFields - stats.filledFields
    },
    processingTime
  }
}

/**
 * Lightweight extraction - skips visual analysis for faster processing
 */
export async function extractSpecificationsFromPDFFast(
  pdfBuffer: Buffer,
  options?: Omit<ExtractionOptions, 'useVisualAnalysis'>
): Promise<ExtractionResult> {
  return extractSpecificationsFromPDF(pdfBuffer, {
    ...options,
    useVisualAnalysis: false,
    generateImageSearchQueries: false
  })
}

/**
 * Updates an item in the extraction result
 */
export function updateItemInResult(
  result: ExtractionResult['items'],
  updatedItem: ExtractedItem
): ExtractionResult['items'] {
  const updateInArray = (arr: ExtractedItem[]): ExtractedItem[] =>
    arr.map(item => item.id === updatedItem.id ? updatedItem : item)

  // Find which confidence level the item is in
  const inHigh = result.high.some(i => i.id === updatedItem.id)
  const inMedium = result.medium.some(i => i.id === updatedItem.id)
  const inLow = result.low.some(i => i.id === updatedItem.id)

  // Remove from old location
  let newResult = {
    high: inHigh ? result.high.filter(i => i.id !== updatedItem.id) : result.high,
    medium: inMedium ? result.medium.filter(i => i.id !== updatedItem.id) : result.medium,
    low: inLow ? result.low.filter(i => i.id !== updatedItem.id) : result.low
  }

  // Add to new location based on updated confidence
  switch (updatedItem.confidence) {
    case 'high':
      newResult.high = [...newResult.high, updatedItem]
      break
    case 'medium':
      newResult.medium = [...newResult.medium, updatedItem]
      break
    case 'low':
      newResult.low = [...newResult.low, updatedItem]
      break
  }

  return newResult
}

/**
 * Finds an item by ID across all confidence levels
 */
export function findItemById(
  result: ExtractionResult['items'],
  itemId: string
): ExtractedItem | null {
  const allItems = [...result.high, ...result.medium, ...result.low]
  return allItems.find(i => i.id === itemId) || null
}

/**
 * Gets all items as a flat array
 */
export function getAllItems(result: ExtractionResult['items']): ExtractedItem[] {
  return [...result.high, ...result.medium, ...result.low]
}

// Re-export types for convenience
export type { ExtractedItem } from './confidence'
export type { ConfidenceLevel, ItemType } from './confidence'
