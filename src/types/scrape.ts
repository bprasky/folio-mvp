// Confidence-scored scraping types for vendor product wizard

export type Confidence = 0 | 1 | 2; // 0=low, 1=medium, 2=high

export type ScrapedValue<T> = { 
  value?: T; 
  confidence: Confidence;
  source?: string; // e.g., "JSON-LD", "OpenGraph", "DOM selector"
};

export interface ScrapeResult {
  success: boolean;
  error?: string;
  sourceUrl: string;
  rawHtml?: string;
  
  identity: {
    name: ScrapedValue<string>;
    sku: ScrapedValue<string>;
    vendorName: ScrapedValue<string>;
    collection: ScrapedValue<string>;
  };
  
  description: ScrapedValue<string>;
  
  media: {
    heroVideoUrl: ScrapedValue<string>;
    heroImageUrl: ScrapedValue<string>;
    gallery: ScrapedValue<Array<{ url: string; width?: number; height?: number; alt?: string }>>;
  };
  
  files: {
    specSheetPdfUrl: ScrapedValue<string>;
    installGuidePdfUrl: ScrapedValue<string>;
    warrantyPdfUrl: ScrapedValue<string>;
    dataSheetPdfUrl: ScrapedValue<string>;
    cad: {
      dwgUrl: ScrapedValue<string>;
      dxfUrl: ScrapedValue<string>;
    };
    bim: {
      rvtUrl: ScrapedValue<string>;
      ifcUrl: ScrapedValue<string>;
    };
    model3d: {
      gltfUrl: ScrapedValue<string>;
      glbUrl: ScrapedValue<string>;
      usdzUrl: ScrapedValue<string>;
      objUrl: ScrapedValue<string>;
      fbxUrl: ScrapedValue<string>;
    };
  };
  
  specs: {
    dimensions: {
      length: ScrapedValue<string>;
      width: ScrapedValue<string>;
      height: ScrapedValue<string>;
      thickness: ScrapedValue<string>;
    };
    weight: { 
      value: ScrapedValue<number>; 
      unit: ScrapedValue<string>;
    };
    materials: ScrapedValue<string[]>;
    finish: ScrapedValue<string>;
    color: ScrapedValue<string>;
    care: ScrapedValue<string>;
    origin: ScrapedValue<string>;
    indoor: ScrapedValue<boolean>;
    outdoor: ScrapedValue<boolean>;
    rooms: ScrapedValue<string[]>;
    leadTime: ScrapedValue<string>;
    availability: ScrapedValue<string>;
    unit: ScrapedValue<string>;
    packaging: ScrapedValue<string>;
    compliance: ScrapedValue<string[]>;
  };
  
  commerce: {
    msrp: ScrapedValue<{ amount: number; currency: string }>;
    variants: ScrapedValue<Array<{ sku?: string; name?: string; options?: Record<string, string> }>>;
  };
  
  links: {
    materialBankSampleUrl: ScrapedValue<string>;
    videoUrl: ScrapedValue<string>;
  };
}

// Helper to create a low-confidence empty value
export function emptyScrapedValue<T>(source?: string): ScrapedValue<T> {
  return { value: undefined, confidence: 0, source };
}

// Helper to create a scraped value with confidence
export function scraped<T>(value: T | undefined, confidence: Confidence, source?: string): ScrapedValue<T> {
  return { value, confidence, source };
}




