import { ScrapeResult, scraped, emptyScrapedValue, Confidence } from '@/types/scrape';
import * as cheerio from 'cheerio';
import { normalizeUrl, pickLargestFromSrcset } from '@/lib/url/normalizeUrl';

// Helper to safely use ScrapedValue that might have null
function toScrapedString(sv: any): any {
  if (!sv || !sv.value) return undefined;
  return sv;
}

/**
 * Extract comprehensive product data from HTML with confidence scoring
 */
export function extractProductData(html: string, sourceUrl: string): ScrapeResult {
  const $ = cheerio.load(html);
  
  // Try structured data first (highest confidence)
  const jsonLd = extractJsonLd($);
  const openGraph = extractOpenGraph($);
  const microdata = extractMicrodata($);
  
  // Fall back to DOM scraping
  const domData = extractFromDom($);
  
  // Merge with priority: JSON-LD > OpenGraph > Microdata > DOM
  const result: ScrapeResult = {
    success: true,
    sourceUrl,
    
    identity: {
      name: jsonLd.name || openGraph.name || microdata.name || domData.name || emptyScrapedValue<string>('none'),
      sku: jsonLd.sku || microdata.sku || domData.sku || emptyScrapedValue<string>('none'),
      vendorName: jsonLd.brand || openGraph.brand || domData.vendor || emptyScrapedValue<string>('none'),
      collection: domData.collection || emptyScrapedValue<string>('none'),
    },
    
    description: jsonLd.description || openGraph.description || microdata.description || domData.description || emptyScrapedValue<string>('none'),
    
    media: {
      heroVideoUrl: toScrapedString(openGraph.video) || toScrapedString(domData.video) || emptyScrapedValue<string>('none'),
      heroImageUrl: toScrapedString(jsonLd.image) || toScrapedString(openGraph.image) || toScrapedString(microdata.image) || toScrapedString(domData.heroImage) || emptyScrapedValue<string>('none'),
      gallery: domData.gallery || emptyScrapedValue<Array<{ url: string; width?: number; height?: number; alt?: string }>>('none'),
    },
    
    files: {
      specSheetPdfUrl: (domData.files.specSheet?.value ? domData.files.specSheet : emptyScrapedValue<string>('none')),
      installGuidePdfUrl: (domData.files.installGuide?.value ? domData.files.installGuide : emptyScrapedValue<string>('none')),
      warrantyPdfUrl: (domData.files.warranty?.value ? domData.files.warranty : emptyScrapedValue<string>('none')),
      dataSheetPdfUrl: (domData.files.dataSheet?.value ? domData.files.dataSheet : emptyScrapedValue<string>('none')),
      cad: {
        dwgUrl: (domData.files.cad.dwg?.value ? domData.files.cad.dwg : emptyScrapedValue<string>('none')),
        dxfUrl: (domData.files.cad.dxf?.value ? domData.files.cad.dxf : emptyScrapedValue<string>('none')),
      },
      bim: {
        rvtUrl: (domData.files.bim.rvt?.value ? domData.files.bim.rvt : emptyScrapedValue<string>('none')),
        ifcUrl: (domData.files.bim.ifc?.value ? domData.files.bim.ifc : emptyScrapedValue<string>('none')),
      },
      model3d: {
        gltfUrl: (domData.files.model3d.gltf?.value ? domData.files.model3d.gltf : emptyScrapedValue<string>('none')),
        glbUrl: (domData.files.model3d.glb?.value ? domData.files.model3d.glb : emptyScrapedValue<string>('none')),
        usdzUrl: (domData.files.model3d.usdz?.value ? domData.files.model3d.usdz : emptyScrapedValue<string>('none')),
        objUrl: (domData.files.model3d.obj?.value ? domData.files.model3d.obj : emptyScrapedValue<string>('none')),
        fbxUrl: (domData.files.model3d.fbx?.value ? domData.files.model3d.fbx : emptyScrapedValue<string>('none')),
      },
    },
    
    specs: {
      dimensions: domData.dimensions,
      weight: domData.weight,
      materials: domData.materials || emptyScrapedValue<string[]>('none'),
      finish: domData.finish || emptyScrapedValue<string>('none'),
      color: domData.color || emptyScrapedValue<string>('none'),
      care: domData.care || emptyScrapedValue<string>('none'),
      origin: domData.origin || emptyScrapedValue<string>('none'),
      indoor: domData.indoor || emptyScrapedValue<boolean>('none'),
      outdoor: domData.outdoor || emptyScrapedValue<boolean>('none'),
      rooms: domData.rooms || emptyScrapedValue<string[]>('none'),
      leadTime: domData.leadTime || emptyScrapedValue<string>('none'),
      availability: domData.availability || emptyScrapedValue<string>('none'),
      unit: domData.unit || emptyScrapedValue<string>('none'),
      packaging: domData.packaging || emptyScrapedValue<string>('none'),
      compliance: domData.compliance || emptyScrapedValue<string[]>('none'),
    },
    
    commerce: {
      msrp: jsonLd.price || microdata.price || domData.price || emptyScrapedValue<{ amount: number; currency: string }>('none'),
      variants: domData.variants || emptyScrapedValue<Array<{ sku?: string; name?: string; options?: Record<string, string> }>>('none'),
    },
    
    links: {
      materialBankSampleUrl: toScrapedString(domData.materialBankUrl) || emptyScrapedValue<string>('none'),
      videoUrl: toScrapedString(openGraph.video) || toScrapedString(domData.video) || emptyScrapedValue<string>('none'),
    },
  };
  
  return result;
}

/**
 * Extract JSON-LD structured data
 */
function extractJsonLd($: cheerio.CheerioAPI) {
  const scripts = $('script[type="application/ld+json"]');
  let productData: any = null;
  
  scripts.each((_, el) => {
    try {
      const json = JSON.parse($(el).html() || '{}');
      if (json['@type'] === 'Product' || json['@type'] === 'http://schema.org/Product') {
        productData = json;
      }
    } catch (e) {
      // Skip invalid JSON
    }
  });
  
  if (!productData) return {};
  
  return {
    name: productData.name ? scraped(productData.name, 2, 'JSON-LD') : undefined,
    sku: productData.sku ? scraped(productData.sku, 2, 'JSON-LD') : undefined,
    description: productData.description ? scraped(stripHtml(productData.description), 2, 'JSON-LD') : undefined,
    brand: productData.brand?.name ? scraped(productData.brand.name, 2, 'JSON-LD') : undefined,
    image: productData.image ? scraped(normalizeUrl(Array.isArray(productData.image) ? productData.image[0] : productData.image), 2, 'JSON-LD') : undefined,
    price: productData.offers?.price ? scraped({
      amount: parseFloat(productData.offers.price),
      currency: productData.offers.priceCurrency || 'USD',
    }, 2, 'JSON-LD') : undefined,
  };
}

/**
 * Extract Open Graph metadata
 */
function extractOpenGraph($: cheerio.CheerioAPI) {
  const get = (property: string) => $(`meta[property="og:${property}"]`).attr('content');
  
  return {
    name: get('title') ? scraped(get('title')!, 2, 'OpenGraph') : undefined,
    description: get('description') ? scraped(stripHtml(get('description')!), 2, 'OpenGraph') : undefined,
    image: get('image') ? scraped(normalizeUrl(get('image')!), 2, 'OpenGraph') : undefined,
    video: get('video') ? scraped(normalizeUrl(get('video')!), 2, 'OpenGraph') : undefined,
    brand: get('brand') ? scraped(get('brand')!, 2, 'OpenGraph') : undefined,
  };
}

/**
 * Extract Microdata
 */
function extractMicrodata($: cheerio.CheerioAPI) {
  const product = $('[itemtype*="schema.org/Product"]').first();
  if (!product.length) return {};
  
  const get = (prop: string) => product.find(`[itemprop="${prop}"]`).first();
  
  return {
    name: get('name').text() ? scraped(get('name').text().trim(), 2, 'Microdata') : undefined,
    sku: get('sku').text() ? scraped(get('sku').text().trim(), 2, 'Microdata') : undefined,
    description: get('description').text() ? scraped(stripHtml(get('description').text()), 2, 'Microdata') : undefined,
    image: get('image').attr('src') ? scraped(normalizeUrl(get('image').attr('src')!), 2, 'Microdata') : undefined,
    price: get('price').attr('content') || get('price').text() ? scraped({
      amount: parseFloat(get('price').attr('content') || get('price').text()),
      currency: get('priceCurrency').attr('content') || 'USD',
    }, 2, 'Microdata') : undefined,
  };
}

/**
 * Extract data from DOM (fallback with lower confidence)
 */
function extractFromDom($: cheerio.CheerioAPI) {
  return {
    name: findBySelectors($, ['h1', '.product-title', '.product-name', '[data-product-title]']) || emptyScrapedValue<string>('DOM'),
    sku: findInText($, /\b(?:SKU|Item #|Model #|Product Code):\s*([A-Z0-9-]+)/i, 'SKU') || emptyScrapedValue<string>('DOM'),
    description: findBySelectors($, ['.product-description', '.description', '[data-description]'], true) || emptyScrapedValue<string>('DOM'),
    vendor: findInText($, /\b(?:Brand|Manufacturer|Vendor):\s*(.+)/i, 'Vendor') || emptyScrapedValue<string>('DOM'),
    collection: findInText($, /\b(?:Collection|Series|Line):\s*(.+)/i, 'Collection') || emptyScrapedValue<string>('DOM'),
    heroImage: findLargestImage($) || emptyScrapedValue<string>('DOM'),
    gallery: extractGallery($) || emptyScrapedValue<Array<{ url: string; width?: number; height?: number; alt?: string }>>('DOM'),
    video: findVideo($) || emptyScrapedValue<string>('DOM'),
    dimensions: extractDimensions($),
    weight: extractWeight($),
    materials: extractListField($, ['Material', 'Materials', 'Composition']) || emptyScrapedValue<string[]>('DOM'),
    finish: findInText($, /\b(?:Finish|Surface):\s*(.+)/i, 'Finish') || emptyScrapedValue<string>('DOM'),
    color: findInText($, /\b(?:Color|Colour):\s*(.+)/i, 'Color') || emptyScrapedValue<string>('DOM'),
    care: findInText($, /\b(?:Care|Maintenance):\s*(.+)/i, 'Care') || emptyScrapedValue<string>('DOM'),
    origin: findInText($, /\b(?:Made in|Origin|Country):\s*(.+)/i, 'Origin') || emptyScrapedValue<string>('DOM'),
    indoor: findBoolean($, ['Indoor', 'Interior']) || emptyScrapedValue<boolean>('DOM'),
    outdoor: findBoolean($, ['Outdoor', 'Exterior', 'Weather']) || emptyScrapedValue<boolean>('DOM'),
    rooms: extractListField($, ['Room', 'Rooms', 'Application', 'Use']) || emptyScrapedValue<string[]>('DOM'),
    leadTime: findInText($, /\b(?:Lead Time|Delivery|Ships in):\s*(.+)/i, 'Lead Time') || emptyScrapedValue<string>('DOM'),
    availability: findInText($, /\b(?:Availability|Stock|In Stock):\s*(.+)/i, 'Availability') || emptyScrapedValue<string>('DOM'),
    unit: findInText($, /\b(?:Sold by|Unit|Per):\s*(.+)/i, 'Unit') || emptyScrapedValue<string>('DOM'),
    packaging: findInText($, /\b(?:Packaging|Box|Carton):\s*(.+)/i, 'Packaging') || emptyScrapedValue<string>('DOM'),
    compliance: extractListField($, ['Compliance', 'Certifications', 'Standards']) || emptyScrapedValue<string[]>('DOM'),
    price: extractPrice($) || emptyScrapedValue<{ amount: number; currency: string }>('DOM'),
    variants: extractVariants($) || emptyScrapedValue<Array<{ sku?: string; name?: string; options?: Record<string, string> }>>('DOM'),
    files: extractFiles($),
    materialBankUrl: findLink($, /material\s*bank/i) || emptyScrapedValue<string>('DOM'),
  };
}

// Helper functions
function findBySelectors($: cheerio.CheerioAPI, selectors: string[], asHtml = false) {
  for (const sel of selectors) {
    const el = $(sel).first();
    if (el.length) {
      const text = asHtml ? el.html() : el.text();
      if (text && text.trim()) {
        return scraped(stripHtml(text.trim()), 1, `DOM: ${sel}`);
      }
    }
  }
  return undefined;
}

function findInText($: cheerio.CheerioAPI, regex: RegExp, label: string) {
  const text = $('body').text();
  const match = text.match(regex);
  return match ? scraped(match[1].trim(), 1, `Regex: ${label}`) : undefined;
}

function findLargestImage($: cheerio.CheerioAPI) {
  const images = $('img')
    .map((_, el) => {
      const $img = $(el);
      const srcset = $img.attr('srcset');
      const src = $img.attr('src') || $img.attr('data-src');
      const width = parseInt($img.attr('width') || '0');
      
      // Try srcset first, fallback to src
      const url = pickLargestFromSrcset(srcset) || normalizeUrl(src);
      
      return url ? { src: url, width } : null;
    })
    .get()
    .filter((img): img is { src: string; width: number } => img !== null && img.width > 400);
  
  if (images.length === 0) return undefined;
  
  images.sort((a, b) => b.width - a.width);
  return scraped(images[0].src, 1, 'DOM: largest image');
}

function extractGallery($: cheerio.CheerioAPI) {
  const images = $('img[src], img[data-src], img[srcset]')
    .map((_, el) => {
      const $img = $(el);
      const srcset = $img.attr('srcset');
      const src = $img.attr('src') || $img.attr('data-src');
      const width = parseInt($img.attr('width') || '0');
      const alt = $img.attr('alt');
      
      // Try srcset first for best quality, fallback to src
      const url = pickLargestFromSrcset(srcset) || normalizeUrl(src);
      
      if (!url || width < 200) return null;
      
      return { url, width, alt };
    })
    .get()
    .filter((img): img is { url: string; width: number; alt: string | undefined } => img !== null);
  
  // Remove duplicates and return
  const unique = Array.from(new Map(images.map(img => [img.url, img])).values());
  
  return unique.length > 0 ? scraped(unique, 1, 'DOM: image gallery') : undefined;
}

function findVideo($: cheerio.CheerioAPI) {
  const video = $('video source, video').first();
  const src = video.attr('src') || video.find('source').attr('src');
  const normalized = src ? normalizeUrl(src) : null;
  return normalized ? scraped(normalized, 1, 'DOM: video') : undefined;
}

function extractDimensions($: cheerio.CheerioAPI) {
  const text = $('body').text();
  
  // Try various dimension patterns
  const patterns = [
    /(\d+(?:\.\d+)?)\s*(?:"|''|in|inches?)\s*[Ww]\s*[×x]\s*(\d+(?:\.\d+)?)\s*(?:"|''|in|inches?)\s*[Dd]\s*[×x]\s*(\d+(?:\.\d+)?)\s*(?:"|''|in|inches?)\s*[Hh]/,
    /[Dd]imensions?:\s*(\d+(?:\.\d+)?)\s*[×x]\s*(\d+(?:\.\d+)?)\s*[×x]\s*(\d+(?:\.\d+)?)\s*(cm|mm|in|"|'')/,
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return {
        length: scraped(match[1], 2, 'Regex: dimensions'),
        width: scraped(match[2], 2, 'Regex: dimensions'),
        height: scraped(match[3], 2, 'Regex: dimensions'),
        thickness: emptyScrapedValue<string>('none'),
      };
    }
  }
  
  return {
    length: emptyScrapedValue<string>('none'),
    width: emptyScrapedValue<string>('none'),
    height: emptyScrapedValue<string>('none'),
    thickness: emptyScrapedValue<string>('none'),
  };
}

function extractWeight($: cheerio.CheerioAPI) {
  const text = $('body').text();
  const match = text.match(/\b(?:Weight|Wt):\s*(\d+(?:\.\d+)?)\s*(lb|lbs|kg|kgs|pounds?|kilograms?)/i);
  
  if (match) {
    return {
      value: scraped(parseFloat(match[1]), 2, 'Regex: weight'),
      unit: scraped(match[2].toLowerCase().startsWith('k') ? 'kg' : 'lb', 2, 'Regex: weight'),
    };
  }
  
  return {
    value: emptyScrapedValue<number>('none'),
    unit: emptyScrapedValue<string>('none'),
  };
}

function extractListField($: cheerio.CheerioAPI, labels: string[]) {
  for (const label of labels) {
    const regex = new RegExp(`\\b${label}:\\s*(.+?)(?:\\n|$)`, 'i');
    const text = $('body').text();
    const match = text.match(regex);
    
    if (match) {
      const items = match[1]
        .split(/[,;\/]/)
        .map(s => s.trim())
        .filter(s => s.length > 0);
      
      return scraped(items, 1, `Regex: ${label}`);
    }
  }
  
  return undefined;
}

function findBoolean($: cheerio.CheerioAPI, keywords: string[]) {
  const text = $('body').text().toLowerCase();
  for (const keyword of keywords) {
    if (text.includes(keyword.toLowerCase())) {
      return scraped(true, 1, `Keyword: ${keyword}`);
    }
  }
  return undefined;
}

function extractPrice($: cheerio.CheerioAPI) {
  const priceText = $('.price, .product-price, [data-price]').first().text();
  const match = priceText.match(/[\$€£]?\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/);
  
  if (match) {
    const amount = parseFloat(match[1].replace(/,/g, ''));
    return scraped({ amount, currency: 'USD' }, 1, 'DOM: price');
  }
  
  return undefined;
}

function extractVariants($: cheerio.CheerioAPI) {
  // Look for variant selectors
  const variants: Array<{ sku?: string; name?: string; options?: Record<string, string> }> = [];
  
  $('.variant, [data-variant]').each((_, el) => {
    const $el = $(el);
    variants.push({
      name: $el.text().trim(),
      sku: $el.attr('data-sku'),
    });
  });
  
  return variants.length > 0 ? scraped(variants, 1, 'DOM: variants') : undefined;
}

function extractFiles($: cheerio.CheerioAPI) {
  const findFile = (pattern: RegExp) => {
    const link = $(`a[href$=".pdf"], a[href$=".dwg"], a[href$=".glb"], a[href*="${pattern}"]`).first();
    const href = link.attr('href');
    const normalized = href ? normalizeUrl(href) : null;
    return normalized ? scraped(normalized, 2, 'DOM: file link') : emptyScrapedValue<string>('none');
  };
  
  const safeNormalizeForFile = (selector: string, label: string) => {
    const el = $(selector).first();
    if (!el.length) return emptyScrapedValue<string>('none');
    const href = el.attr('href');
    const normalized = href ? normalizeUrl(href) : null;
    return normalized ? scraped(normalized, 2, label) : emptyScrapedValue<string>('none');
  };
  
  return {
    specSheet: findFile(/spec|specification|datasheet|data-sheet/i),
    installGuide: findFile(/install|installation/i),
    warranty: findFile(/warranty|guarantee/i),
    dataSheet: findFile(/datasheet|data-sheet/i),
    cad: {
      dwg: safeNormalizeForFile('a[href$=".dwg"]', 'DOM: DWG'),
      dxf: safeNormalizeForFile('a[href$=".dxf"]', 'DOM: DXF'),
    },
    bim: {
      rvt: safeNormalizeForFile('a[href$=".rvt"]', 'DOM: RVT'),
      ifc: safeNormalizeForFile('a[href$=".ifc"]', 'DOM: IFC'),
    },
    model3d: {
      gltf: safeNormalizeForFile('a[href$=".gltf"]', 'DOM: GLTF'),
      glb: safeNormalizeForFile('a[href$=".glb"]', 'DOM: GLB'),
      usdz: safeNormalizeForFile('a[href$=".usdz"]', 'DOM: USDZ'),
      obj: safeNormalizeForFile('a[href$=".obj"]', 'DOM: OBJ'),
      fbx: safeNormalizeForFile('a[href$=".fbx"]', 'DOM: FBX'),
    },
  };
}

function findLink($: cheerio.CheerioAPI, pattern: RegExp) {
  const link = $('a').filter((_, el) => pattern.test($(el).text() || $(el).attr('href') || '')).first();
  const href = link.attr('href');
  const normalized = href ? normalizeUrl(href) : null;
  return normalized ? scraped(normalized, 1, 'DOM: link') : undefined;
}

function stripHtml(text: string): string {
  return text.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

// Note: normalizeUrl is now imported from @/lib/url/normalizeUrl

