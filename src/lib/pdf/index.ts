/**
 * PDF Specification Extraction System
 *
 * A two-track extraction system that:
 * 1. Extracts structured text from PDFs and maps to product fields
 * 2. Associates text annotations with nearby images
 * 3. Scores confidence based on data completeness
 * 4. Presents items grouped by confidence for efficient review
 * 5. Enables AI-powered field completion for specifications with gaps
 * 6. Converts inspiration images into searchable placeholders
 */

// Main extraction pipeline
export {
  extractSpecificationsFromPDF,
  extractSpecificationsFromPDFFast,
  updateItemInResult,
  findItemById,
  getAllItems
} from './extractionPipeline'

export type {
  ExtractionOptions,
  ExtractionResult
} from './extractionPipeline'

// Extracted item types and confidence scoring
export {
  createExtractedItem,
  recalculateItemFields,
  scoreConfidence,
  determineItemType,
  calculateCompleteness,
  identifyMissingFields,
  generateSearchQuery,
  groupByConfidence,
  calculateStats
} from './confidence'

export type {
  ExtractedItem,
  ConfidenceLevel,
  ItemType
} from './confidence'

// AI enhancement functions
export {
  completeSpecificationWithAI,
  generateInspirationSearchQuery,
  analyzePageImage,
  enhanceItemsWithAI
} from './aiEnhancement'

// Text extraction utilities
export {
  extractPDFContent,
  extractImageFromPDF,
  renderPDFPage
} from './extractText'

export type {
  TextBlock,
  ImageRegion,
  PDFExtractionResult
} from './extractText'

// Pattern recognition
export {
  SPEC_PATTERNS,
  parsePrice,
  parseDimensions,
  extractBrand,
  extractProductName,
  extractSKU,
  extractURL,
  extractQuantity,
  parseTextCluster
} from './patterns'

export type {
  ParsedDimensions,
  ParsedSpecification
} from './patterns'

// Clustering utilities
export {
  clusterTextBlocks,
  associateClustersWithImages,
  groupByPage,
  filterProductClusters
} from './clustering'

export type {
  TextCluster,
  ItemAssociation,
  ClusteringOptions,
  AssociationOptions
} from './clustering'
