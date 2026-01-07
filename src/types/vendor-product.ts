// Types for vendor product creation wizard

export interface ScrapeResult {
  success: boolean;
  data?: {
    title: string;
    description: string;
    price?: number;
    sku?: string;
    images: Array<{
      url: string;
      width?: number;
      height?: number;
      alt?: string;
    }>;
    specs?: {
      dimensions?: string;
      materials?: string[];
      finish?: string;
      weight?: string;
    };
    files?: Array<{
      url: string;
      type: 'pdf' | '3d' | 'cad' | 'other';
      label: string;
    }>;
    category?: string;
    tags?: string[];
    vendor?: string;
    sourceUrl: string;
  };
  error?: string;
  rawHtml?: string;
}

export interface ProductDraft {
  // Basic info
  name: string;
  sku: string;
  description: string;
  vendorId: string;
  
  // Pricing (optional for trade)
  price?: number;
  
  // Specifications
  dimensions?: {
    w: number;
    d: number;
    h: number;
    units: 'in' | 'cm';
  };
  weight?: {
    value: number;
    units: 'lb' | 'kg';
  };
  materials: string[];
  finish: string;
  care?: string;
  leadTime?: string;
  
  // Media
  heroMedia: {
    type: 'video' | 'image';
    url: string;
    alt?: string;
  };
  gallery: Array<{
    type: 'image' | 'video';
    url: string;
    alt?: string;
  }>;
  palette?: {
    primary: string;
    secondary: string;
    accent: string;
  };
  
  // Files
  files: {
    specSheets: Array<{ label: string; url: string }>;
    _3d: Array<{ label: string; url: string }>;
    others?: Array<{ label: string; url: string }>;
  };
  
  // Categorization
  category: string;
  tags: string[];
  
  // Source tracking
  sourceUrl?: string;
  
  // Publishing
  status: 'draft' | 'published';
}

export interface ProductDraftWithId extends ProductDraft {
  id: string;
  slug: string;
  createdAt: string;
  updatedAt: string;
}

export interface ColorPalette {
  primary: string;
  secondary: string;
  accent: string;
  all: string[]; // All extracted colors
}

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}




