'use server';

import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { normalizeUrl, isValidImageUrl, validateImageList } from '@/lib/url/normalizeUrl';
import { getContent, hasBrowserlessKey } from '@/lib/browserless/client';
import { looksLikeBotWall } from '@/lib/browserless/classify';
import { recordScrapeAttempt } from '@/lib/browserless/record';

export type ProductListParams = {
  q?: string | null;
  page?: number;
  pageSize?: number;
  includeDrafts?: boolean;
  vendorUserId?: string | null;
};

export async function listVendorProducts(params: ProductListParams = {}) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user) {
    throw new Error('Unauthorized');
  }

  const {
    q = null,
    page = 1,
    pageSize = 20,
    includeDrafts = true, // Show both published and drafts by default
    vendorUserId = session.user.role?.toLowerCase() === 'vendor' ? session.user.id : null,
  } = params;

  // Build where clause
  const where: any = {};
  
  // Filter by vendor if applicable
  if (vendorUserId) {
    where.vendorId = vendorUserId;
  }
  
  // Search by name or brand
  if (q) {
    where.OR = [
      { name: { contains: q, mode: 'insensitive' } },
      { brand: { contains: q, mode: 'insensitive' } },
    ];
  }
  
  // Filter by published status if needed
  if (!includeDrafts) {
    where.isPending = false; // Only show published products
  }

  // Fetch products
  const [items, total] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        name: true,
        brand: true,
        imageUrl: true,
        isPending: true,
        createdAt: true,
        vendorId: true,
        vendor: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    }),
    prisma.product.count({ where }),
  ]);

  // Map to expected format
  const rows = items.map(p => ({
    id: p.id,
    name: p.name,
    skuOrBrand: p.brand || '—',
    imageUrl: p.imageUrl,
    status: p.isPending ? 'DRAFT' : 'PUBLISHED',
    createdAt: p.createdAt,
    vendorName: p.vendor?.name || '—',
    href: `/products/${p.id}`, // Use id as slug
  }));

  return {
    items: rows,
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function listVendors() {
  const session = await getServerSession(authOptions);
  
  if (!session?.user) {
    throw new Error('Unauthorized');
  }

  // If vendor, return only self
  if (session.user.role?.toLowerCase() === 'vendor') {
    return [
      {
        id: session.user.id || '',
        name: session.user.name || 'You',
      },
    ];
  }

  // Admin can see all vendors
  const vendors = await prisma.user.findMany({
    where: {
      role: 'VENDOR',
    },
    select: {
      id: true,
      name: true,
    },
    orderBy: {
      name: 'asc',
    },
  });

  return vendors;
}

/**
 * Scrape product information through the isolated renderer
 */
export async function scrapeProduct(url: string): Promise<any> {
  try {
    if (!hasBrowserlessKey()) {
      return createEmptyScrapeResult(url, 'Product rendering is temporarily unavailable. Please enter the product details manually.');
    }

    // Validate URL
    try {
      new URL(url);
    } catch {
      return createEmptyScrapeResult(url, 'Invalid URL format');
    }

    // The shared adapter uses the isolated worker and its fixed bounds.
    const response = await getContent(url);
    await recordScrapeAttempt({ url, consumer: 'VENDOR_WIZARD', result: response });

    if (!response.ok) {
      console.error('Isolated renderer unavailable:', {
        status: response.status,
        error: response.error,
      });

      return createEmptyScrapeResult(url, 'Product rendering is temporarily unavailable. Please enter the product details manually.');
    }

    const html = response.payload;

    // A bot wall returns a denial page, not the product. Use the shared
    // classifier so this path no longer turns a denial page title into a
    // low-confidence product, matching the /api/scrape-product route.
    if (looksLikeBotWall(html)) {
      return createEmptyScrapeResult(url, 'This retailer blocked automated access to that page. Please enter the product details manually.');
    }

    // Extract product information with confidence scoring
    const { extractProductData } = await import('@/lib/vendor/extractProductData');
    const scraped = extractProductData(html, url);

    return scraped;
  } catch (error: any) {
    console.error('Scrape error:', error);
    return createEmptyScrapeResult(url, error.message || 'Failed to scrape product');
  }
}

/**
 * Create an empty scrape result (for errors)
 */
function createEmptyScrapeResult(url: string, error: string): any {
  return {
    success: false,
    error,
    sourceUrl: url,
    identity: {
      name: { value: undefined, confidence: 0 },
      sku: { value: undefined, confidence: 0 },
      vendorName: { value: undefined, confidence: 0 },
      collection: { value: undefined, confidence: 0 },
    },
    description: { value: undefined, confidence: 0 },
    media: {
      heroVideoUrl: { value: undefined, confidence: 0 },
      heroImageUrl: { value: undefined, confidence: 0 },
      gallery: { value: undefined, confidence: 0 },
    },
    files: {
      specSheetPdfUrl: { value: undefined, confidence: 0 },
      installGuidePdfUrl: { value: undefined, confidence: 0 },
      warrantyPdfUrl: { value: undefined, confidence: 0 },
      dataSheetPdfUrl: { value: undefined, confidence: 0 },
      cad: {
        dwgUrl: { value: undefined, confidence: 0 },
        dxfUrl: { value: undefined, confidence: 0 },
      },
      bim: {
        rvtUrl: { value: undefined, confidence: 0 },
        ifcUrl: { value: undefined, confidence: 0 },
      },
      model3d: {
        gltfUrl: { value: undefined, confidence: 0 },
        glbUrl: { value: undefined, confidence: 0 },
        usdzUrl: { value: undefined, confidence: 0 },
        objUrl: { value: undefined, confidence: 0 },
        fbxUrl: { value: undefined, confidence: 0 },
      },
    },
    specs: {
      dimensions: {
        length: { value: undefined, confidence: 0 },
        width: { value: undefined, confidence: 0 },
        height: { value: undefined, confidence: 0 },
        thickness: { value: undefined, confidence: 0 },
      },
      weight: {
        value: { value: undefined, confidence: 0 },
        unit: { value: undefined, confidence: 0 },
      },
      materials: { value: undefined, confidence: 0 },
      finish: { value: undefined, confidence: 0 },
      color: { value: undefined, confidence: 0 },
      care: { value: undefined, confidence: 0 },
      origin: { value: undefined, confidence: 0 },
      indoor: { value: undefined, confidence: 0 },
      outdoor: { value: undefined, confidence: 0 },
      rooms: { value: undefined, confidence: 0 },
      leadTime: { value: undefined, confidence: 0 },
      availability: { value: undefined, confidence: 0 },
      unit: { value: undefined, confidence: 0 },
      packaging: { value: undefined, confidence: 0 },
      compliance: { value: undefined, confidence: 0 },
    },
    commerce: {
      msrp: { value: undefined, confidence: 0 },
      variants: { value: undefined, confidence: 0 },
    },
    links: {
      materialBankSampleUrl: { value: undefined, confidence: 0 },
      videoUrl: { value: undefined, confidence: 0 },
    },
  };
}

/**
 * Publish product to database
 */
export async function publishProduct(payload: any): Promise<{ success: boolean; slug?: string; error?: string }> {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return {
        success: false,
        error: 'Unauthorized',
      };
    }

    // Generate slug
    const slug = generateSlug(payload.name, payload.sku);

    // Normalize and validate image URLs
    const heroUrl = normalizeUrl(payload.heroMedia?.url || payload.gallery?.[0]?.url);
    
    // Validate hero image URL
    if (heroUrl && !/^https?:\/\//i.test(heroUrl)) {
      console.warn('⚠️ Invalid hero URL, using null:', heroUrl);
    }
    
    // Check for common corruption patterns
    if (heroUrl && /https?:\/\/.*https?:\/\//i.test(heroUrl)) {
      throw new Error('Hero image URL contains duplicate protocol. Please check the image URL and try again.');
    }

    // Validate and use the URL
    const validatedImageUrl = heroUrl && isValidImageUrl(heroUrl) ? heroUrl : null;
    
    if (!validatedImageUrl) {
      console.warn('⚠️ No valid hero image URL, product will be created without thumbnail');
    }

    // Create product in database
    const product = await prisma.product.create({
      data: {
        name: payload.name,
        description: payload.description,
        brand: payload.brand || payload.sku || payload.name,
        category: payload.category,
        imageUrl: validatedImageUrl,
        isPending: false, // Published
        vendorId: session.user.id,
        url: payload.sourceUrl,
      },
    });

    console.log('✅ Product published:', product.id, product.name);

    return {
      success: true,
      slug: product.id, // Use id as slug
    };
  } catch (error: any) {
    console.error('Publish error:', error);
    return {
      success: false,
      error: error.message || 'Failed to publish product',
    };
  }
}

/**
 * Generate URL-safe slug
 */
function generateSlug(name: string, sku?: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  
  if (sku) {
    const skuPart = sku
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    return `${base}-${skuPart}`;
  }
  
  return base;
}
