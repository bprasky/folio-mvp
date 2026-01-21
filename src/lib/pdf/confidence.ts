/**
 * Confidence Scoring Module
 * Scores extracted items based on data completeness
 */

import type { ImageRegion } from './extractText'
import type { ParsedDimensions } from './patterns'
import { SPEC_PATTERNS } from './patterns'

export type ConfidenceLevel = 'high' | 'medium' | 'low'
export type ItemType = 'specification' | 'inspiration'

export interface ExtractedItem {
  id: string  // Generated UUID
  confidence: ConfidenceLevel
  type: ItemType

  // Extracted/parsed fields
  productName: string | null
  brand: string | null
  vendor: string | null  // May differ from brand
  sku: string | null
  price: number | null   // In cents
  currency: string
  dimensions: ParsedDimensions | null
  material: string | null
  finish: string | null
  description: string | null
  productUrl: string | null
  quantity: number | null

  // Source data
  imageData: string | null      // Base64 of cropped image
  imageBounds: ImageRegion['bounds'] | null
  sourceText: string[]          // Original text blocks
  page: number

  // Computed helpers
  missingFields: string[]
  completenessScore: number     // 0-1
  searchQuery: string           // AI-generated or derived
}

/**
 * Key fields used for completeness scoring
 */
const COMPLETENESS_FIELDS: (keyof ExtractedItem)[] = [
  'productName',
  'brand',
  'price',
  'sku',
  'dimensions',
  'material',
  'productUrl'
]

/**
 * Scores the confidence level of an extracted item
 */
export function scoreConfidence(item: ExtractedItem): ConfidenceLevel {
  const hasName = !!item.productName
  const hasBrand = !!item.brand
  const hasPrice = !!item.price
  const hasDimensions = !!(item.dimensions?.width || item.dimensions?.diameter)
  const hasSKU = !!item.sku

  // HIGH: Identifiable product with pricing
  // Can be added to spec sheet with minimal intervention
  if (hasName && hasBrand && hasPrice) {
    return 'high'
  }

  // MEDIUM: Partial identification
  // Needs some completion but clearly a product
  if ((hasName && hasBrand) || (hasBrand && hasPrice) || (hasName && hasPrice)) {
    return 'medium'
  }

  // Also MEDIUM: Has brand/vendor from known list even without full details
  if (hasBrand && isKnownVendor(item.brand)) {
    return 'medium'
  }

  // Also MEDIUM: Has significant product indicators
  if (hasSKU || (hasDimensions && (hasName || hasBrand))) {
    return 'medium'
  }

  // LOW: Minimal or no structured data
  // Likely inspiration or needs full manual entry
  return 'low'
}

/**
 * Checks if a brand name matches a known vendor
 */
function isKnownVendor(brand: string | null): boolean {
  if (!brand) return false

  const brandUpper = brand.toUpperCase()
  return SPEC_PATTERNS.knownVendors.some(v =>
    brandUpper.includes(v) || v.includes(brandUpper)
  )
}

/**
 * Determines if an item is a specification or inspiration
 */
export function determineItemType(item: ExtractedItem): ItemType {
  // If ANY structured product data exists, treat as specification
  if (item.productName || item.brand || item.price || item.sku) {
    return 'specification'
  }

  // If we have dimensions or material, it's likely a spec
  if (item.dimensions || item.material) {
    return 'specification'
  }

  return 'inspiration'
}

/**
 * Calculates the completeness score (0-1)
 */
export function calculateCompleteness(item: ExtractedItem): number {
  let filled = 0

  for (const field of COMPLETENESS_FIELDS) {
    const val = item[field]
    if (val !== null && val !== undefined) {
      filled++
    }
  }

  return filled / COMPLETENESS_FIELDS.length
}

/**
 * Identifies which fields are missing from an item
 */
export function identifyMissingFields(item: ExtractedItem): string[] {
  const missing: string[] = []

  if (!item.productName) missing.push('productName')
  if (!item.brand) missing.push('brand')
  if (!item.price) missing.push('price')
  if (!item.sku) missing.push('sku')
  if (!item.dimensions) missing.push('dimensions')
  if (!item.material) missing.push('material')
  if (!item.productUrl) missing.push('productUrl')

  return missing
}

/**
 * Generates a search query from the item's data
 */
export function generateSearchQuery(item: ExtractedItem): string {
  // For specifications: combine known fields
  if (item.type === 'specification') {
    const parts = [item.brand, item.productName, item.material].filter(Boolean)
    if (parts.length > 0) {
      return parts.join(' ')
    }

    // Fallback to source text if we have it
    if (item.sourceText.length > 0) {
      return item.sourceText
        .join(' ')
        .substring(0, 100)
        .trim()
    }
  }

  // For inspiration: will be AI-generated from image
  return item.description || 'Unknown item'
}

/**
 * Creates an ExtractedItem with computed fields
 */
export function createExtractedItem(
  id: string,
  data: Omit<ExtractedItem, 'id' | 'confidence' | 'type' | 'missingFields' | 'completenessScore' | 'searchQuery'>
): ExtractedItem {
  const item: ExtractedItem = {
    id,
    ...data,
    confidence: 'low',
    type: 'inspiration',
    missingFields: [],
    completenessScore: 0,
    searchQuery: ''
  }

  // Calculate derived fields
  item.type = determineItemType(item)
  item.confidence = scoreConfidence(item)
  item.missingFields = identifyMissingFields(item)
  item.completenessScore = calculateCompleteness(item)
  item.searchQuery = generateSearchQuery(item)

  return item
}

/**
 * Updates an item's computed fields after modification
 */
export function recalculateItemFields(item: ExtractedItem): ExtractedItem {
  return {
    ...item,
    type: determineItemType(item),
    confidence: scoreConfidence(item),
    missingFields: identifyMissingFields(item),
    completenessScore: calculateCompleteness(item),
    searchQuery: generateSearchQuery(item)
  }
}

/**
 * Groups items by confidence level
 */
export function groupByConfidence(items: ExtractedItem[]): {
  high: ExtractedItem[]
  medium: ExtractedItem[]
  low: ExtractedItem[]
} {
  return {
    high: items.filter(i => i.confidence === 'high'),
    medium: items.filter(i => i.confidence === 'medium'),
    low: items.filter(i => i.confidence === 'low')
  }
}

/**
 * Calculates aggregate statistics for a set of items
 */
export function calculateStats(items: ExtractedItem[]): {
  totalImages: number
  specificationsFound: number
  inspirationImages: number
  totalFields: number
  filledFields: number
  avgCompleteness: number
} {
  const specifications = items.filter(i => i.type === 'specification')
  const inspirations = items.filter(i => i.type === 'inspiration')

  const totalFields = items.length * COMPLETENESS_FIELDS.length
  const filledFields = items.reduce((sum, i) =>
    sum + (COMPLETENESS_FIELDS.length - i.missingFields.length), 0
  )

  const avgCompleteness = items.length > 0
    ? items.reduce((sum, i) => sum + i.completenessScore, 0) / items.length
    : 0

  return {
    totalImages: items.filter(i => i.imageData !== null).length,
    specificationsFound: specifications.length,
    inspirationImages: inspirations.length,
    totalFields,
    filledFields,
    avgCompleteness
  }
}
