// Types for the Folio Import Agent

export type ProductCategory =
  | 'FURNITURE'
  | 'LIGHTING'
  | 'RUG'
  | 'ART'
  | 'FIXTURES'
  | 'MATERIALS'
  | 'TEXTILES'
  | 'ACCESSORIES'
  | 'HARDWARE'
  | 'APPLIANCES'
  | 'OTHER';

export type RoomType =
  | 'living_room'
  | 'bedroom'
  | 'kitchen'
  | 'bathroom'
  | 'dining_room'
  | 'office'
  | 'entry'
  | 'outdoor'
  | 'hallway'
  | 'laundry'
  | 'closet'
  | 'other';

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export interface DetectedProduct {
  description: string;           // "Navy velvet sofa with brass legs"
  category: ProductCategory;
  position: { x: number; y: number }; // Normalized 0-1 coordinates
  confidence: ConfidenceLevel;
  searchQuery: string;           // Optimized query for web search
  // Extracted text specs from visual analysis (when visible near the product)
  extractedVendor?: string;      // "Serena & Lily", "RH", etc.
  extractedPrice?: string;       // "$1,299", "2,500 USD", etc.
  extractedDimensions?: string;  // "72W x 36D x 30H"
  extractedSku?: string;         // "SKU12345"
  extractedProductName?: string; // "Harbor Sofa" if visible
}

export interface RoomAnalysis {
  roomType: RoomType;
  products: DetectedProduct[];
  styleIndicators: string[];     // "mid-century modern", "coastal", etc.
  dominantColors: string[];
  materials: string[];
}

export interface ProductAttribution {
  productUrl: string;
  vendorName: string;
  productName: string;
  price?: string;
  confidence: ConfidenceLevel;
  matchReason: string;
}

export interface ExtractedImage {
  pageNumber?: number;
  base64?: string;
  url?: string;
  mimeType: string;
  width?: number;
  height?: number;
  isSkipped?: boolean;
  skipReason?: string;
  needsRendering?: boolean;
}

export interface PdfDocument {
  url: string;
  pageCount: number;
  fileName: string;
}

export interface ImportJob {
  sessionId: string;
  fileUrl?: string;
  websiteUrl?: string;
  projectId?: string;
  userId: string;
}

export interface ProcessingResult {
  success: boolean;
  totalImages: number;
  analyzedImages: number;
  totalProducts: number;
  pendingTagsCreated: number;
  error?: string;
}

export interface AnalysisContext {
  roomHint?: string;
  projectStyle?: string;
  preferredVendors?: string[];
}
