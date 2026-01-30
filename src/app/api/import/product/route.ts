export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import Anthropic from '@anthropic-ai/sdk';
import * as cheerio from 'cheerio';

export const runtime = 'nodejs';

const anthropic = new Anthropic();

/**
 * Helper to normalize brand names for matching
 */
function normalizeBrandName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Helper to log product searches for business intelligence
 */
async function logProductSearch(params: {
  userId: string;
  searchType: string;
  brandName?: string | null;
  productName?: string | null;
  searchQuery?: string | null;
  selectionId?: string | null;
  projectId?: string | null;
  wasSuccessful: boolean;
  matchedProductId?: string | null;
  resultData?: Record<string, unknown> | null;
}) {
  try {
    await prisma.productSearchLog.create({
      data: {
        userId: params.userId,
        searchType: params.searchType,
        brandName: params.brandName || null,
        productName: params.productName || null,
        searchQuery: params.searchQuery || null,
        selectionId: params.selectionId || null,
        projectId: params.projectId || null,
        wasSuccessful: params.wasSuccessful,
        matchedProductId: params.matchedProductId || null,
        resultData: params.resultData || null,
      },
    });
  } catch (error) {
    // Don't fail the request if logging fails
    console.error('Failed to log product search:', error);
  }
}

/**
 * Extract image URL from HTML using Browserless
 */
async function extractImageFromUrl(url: string): Promise<string | null> {
  const token = process.env.BROWSERLESS_API_KEY;
  if (!token) {
    console.log('No Browserless API key, skipping image extraction');
    return null;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

    const htmlRes = await fetch(`https://production-sfo.browserless.io/content?token=${token}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!htmlRes.ok) {
      console.error('Browserless fetch failed:', htmlRes.status);
      return null;
    }

    const html = await htmlRes.text();
    const $ = cheerio.load(html);

    // Try multiple strategies to find the main product image
    let imageUrl: string | null = null;

    // 1. OpenGraph image
    imageUrl = $('meta[property="og:image"]').attr('content') || null;
    if (imageUrl && isValidImageUrl(imageUrl)) return imageUrl;

    // 2. Twitter image
    imageUrl = $('meta[name="twitter:image"]').attr('content') || null;
    if (imageUrl && isValidImageUrl(imageUrl)) return imageUrl;

    // 3. JSON-LD Product schema
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const json = JSON.parse($(el).contents().text() || '{}');
        const product = Array.isArray(json)
          ? json.find((j) => j['@type'] === 'Product')
          : (json['@type'] === 'Product' ? json : json['@graph']?.find((n: any) => n['@type'] === 'Product'));

        if (product?.image) {
          imageUrl = Array.isArray(product.image) ? product.image[0] : product.image;
        }
      } catch {
        // Ignore JSON parse errors
      }
    });
    if (imageUrl && isValidImageUrl(imageUrl)) return imageUrl;

    // 4. Look for large images in common product image containers
    const selectors = [
      '[data-testid="product-image"] img',
      '.product-image img',
      '.product-gallery img',
      '#product-image img',
      '.pdp-image img',
      '[class*="ProductImage"] img',
      '[class*="product-image"] img',
      'main img[src*="product"]',
      'main img[src*="Product"]',
    ];

    for (const selector of selectors) {
      const img = $(selector).first();
      const src = img.attr('src') || img.attr('data-src');
      if (src && isValidImageUrl(src)) {
        imageUrl = src;
        break;
      }
    }

    return imageUrl;
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.log('Browserless request timed out');
    } else {
      console.error('Error extracting image:', error.message);
    }
    return null;
  }
}

/**
 * Check if URL looks like a valid product image
 */
function isValidImageUrl(url: string): boolean {
  if (!url) return false;
  // Skip tiny images, icons, logos
  const skipPatterns = ['/icon', '/logo', '/favicon', 'sprite', '1x1', 'pixel', 'tracking'];
  if (skipPatterns.some(p => url.toLowerCase().includes(p))) return false;
  // Must be an image URL or from CDN
  return url.match(/\.(jpg|jpeg|png|webp|gif)/i) !== null ||
         url.includes('cdn') ||
         url.includes('cloudinary') ||
         url.includes('imgix');
}

/**
 * POST /api/import/product
 * Uses AI with web search to extract product information from a URL
 * Checks cache first, uses Browserless for image extraction
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string })?.id;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('Import product API called');
    const { url, projectId, roomId } = await req.json();
    console.log('URL received:', url);

    if (!url) {
      return NextResponse.json({ error: 'Missing url' }, { status: 400 });
    }

    // Normalize URL for caching (remove trailing slashes, query params for cache key)
    const normalizedUrl = url.split('?')[0].replace(/\/+$/, '');

    // 1. CHECK CACHE FIRST
    let cachedProduct = await prisma.cachedProduct.findUnique({
      where: { url: normalizedUrl },
    });

    if (cachedProduct) {
      console.log('Cache hit for URL:', normalizedUrl);

      // Update fetch count and timestamp
      await prisma.cachedProduct.update({
        where: { id: cachedProduct.id },
        data: {
          fetchCount: { increment: 1 },
          lastFetchedAt: new Date(),
        },
      });

      // Log cache hit
      await logProductSearch({
        userId,
        searchType: 'URL_IMPORT_CACHE_HIT',
        brandName: cachedProduct.brand,
        productName: cachedProduct.productName,
        searchQuery: url,
        projectId,
        wasSuccessful: true,
        matchedProductId: cachedProduct.id,
        resultData: { cached: true },
      });

      // Return cached data
      return NextResponse.json({
        ok: true,
        cached: true,
        data: {
          title: cachedProduct.productName || '',
          description: cachedProduct.description || '',
          imageUrl: cachedProduct.imageUrl || '',
          sku: cachedProduct.sku || '',
          brand: cachedProduct.brand || '',
          vendorName: cachedProduct.vendorName || '',
          url: cachedProduct.url,
          price: cachedProduct.priceCents ? cachedProduct.priceCents / 100 : null,
          currency: cachedProduct.currency || 'USD',
          dimensions: cachedProduct.widthIn || cachedProduct.depthIn || cachedProduct.heightIn ? {
            width: cachedProduct.widthIn ? Number(cachedProduct.widthIn) : undefined,
            depth: cachedProduct.depthIn ? Number(cachedProduct.depthIn) : undefined,
            height: cachedProduct.heightIn ? Number(cachedProduct.heightIn) : undefined,
          } : undefined,
          materialType: cachedProduct.materialType,
          style: cachedProduct.style,
        },
      });
    }

    console.log('Cache miss, fetching from AI + Browserless');

    // 2. FETCH DATA WITH AI (parallel with image extraction)
    const [aiResponse, imageUrl] = await Promise.all([
      // AI web search for product data
      anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2048,
        tools: [
          {
            type: 'web_search_20250305',
            name: 'web_search',
          },
        ],
        messages: [
          {
            role: 'user',
            content: `You are a product data extraction assistant. Search for and analyze this product URL to extract complete product information:

URL: ${url}

Search for and extract all available information about this product:
1. Product name/title (exact name from the product page)
2. Brand/manufacturer
3. Price (in USD, as a number without currency symbol)
4. SKU or model number
5. Product description (brief, 1-2 sentences)
6. Dimensions (width, depth, height in inches)
7. Vendor/retailer name (the website selling it)
8. Material type: classify as one of: stone, tile, wood, fabric, metal, lighting, appliance, furniture, other
9. Style: classify as one of: modern, traditional, transitional, industrial, coastal, farmhouse, minimalist, bohemian, contemporary, other

Return ONLY a valid JSON object with the extracted information:
{
  "title": "exact product name",
  "brand": "brand name",
  "vendorName": "retailer/website name",
  "sku": "SKU or model number",
  "price": 1299.00,
  "currency": "USD",
  "description": "brief product description",
  "dimensions": {
    "width": 84,
    "depth": 38,
    "height": 32
  },
  "materialType": "stone",
  "style": "modern",
  "confidence": "high"
}

If you cannot find specific information, omit that field rather than guessing.`,
          },
        ],
      }),
      // Browserless for image extraction
      extractImageFromUrl(url),
    ]);

    // Extract text from AI response
    let text = '';
    for (const block of aiResponse.content) {
      if (block.type === 'text') {
        text += block.text;
      }
    }

    console.log('AI response text:', text.substring(0, 500));

    // Parse JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      await logProductSearch({
        userId,
        searchType: 'URL_IMPORT',
        searchQuery: url,
        projectId,
        wasSuccessful: false,
        resultData: { noJsonResponse: true },
      });

      return NextResponse.json(
        { error: 'Could not extract product information from URL', data: null },
        { status: 200 }
      );
    }

    const productData = JSON.parse(jsonMatch[0]);
    console.log('Parsed product data:', productData);
    console.log('Extracted image URL:', imageUrl);

    // 3. SAVE TO CACHE
    try {
      cachedProduct = await prisma.cachedProduct.create({
        data: {
          url: normalizedUrl,
          productName: productData.title || null,
          brand: productData.brand || null,
          vendorName: productData.vendorName || null,
          sku: productData.sku || null,
          priceCents: productData.price ? Math.round(productData.price * 100) : null,
          currency: productData.currency || 'USD',
          description: productData.description || null,
          imageUrl: imageUrl || null,
          widthIn: productData.dimensions?.width || null,
          depthIn: productData.dimensions?.depth || null,
          heightIn: productData.dimensions?.height || null,
          materialType: productData.materialType || null,
          style: productData.style || null,
          extractionConfidence: productData.confidence || 'medium',
          aiResponse: productData,
        },
      });
      console.log('Cached product created:', cachedProduct.id);

      // 4. UPDATE BRAND REGISTRY
      if (productData.brand) {
        const normalizedBrand = normalizeBrandName(productData.brand);
        await prisma.brandRegistry.upsert({
          where: { normalizedName: normalizedBrand },
          create: {
            name: productData.brand,
            normalizedName: normalizedBrand,
            productCount: 1,
            knownRetailerUrls: productData.vendorName ? [new URL(url).hostname] : [],
          },
          update: {
            productCount: { increment: 1 },
            knownRetailerUrls: productData.vendorName
              ? { push: new URL(url).hostname }
              : undefined,
          },
        });
      }
    } catch (cacheError: any) {
      // If cache insert fails (e.g., race condition), try to fetch existing
      if (cacheError.code === 'P2002') {
        cachedProduct = await prisma.cachedProduct.findUnique({
          where: { url: normalizedUrl },
        });
      } else {
        console.error('Failed to cache product:', cacheError);
      }
    }

    // Log successful import
    await logProductSearch({
      userId,
      searchType: 'URL_IMPORT',
      brandName: productData.brand || productData.vendorName,
      productName: productData.title,
      searchQuery: url,
      projectId,
      wasSuccessful: true,
      matchedProductId: cachedProduct?.id || null,
      resultData: {
        confidence: productData.confidence,
        foundPrice: !!productData.price,
        foundDimensions: !!productData.dimensions,
        foundImage: !!imageUrl,
        cached: false,
      },
    });

    // Return data
    const data = {
      title: productData.title || '',
      description: productData.description || '',
      imageUrl: imageUrl || '',
      sku: productData.sku || '',
      brand: productData.brand || '',
      vendorName: productData.vendorName || '',
      url: normalizedUrl,
      price: productData.price,
      currency: productData.currency || 'USD',
      dimensions: productData.dimensions,
      materialType: productData.materialType,
      style: productData.style,
    };

    console.log('Returning data:', {
      title: data.title,
      brand: data.brand,
      imageUrl: data.imageUrl?.substring(0, 50) + '...',
      price: data.price,
    });

    return NextResponse.json({ ok: true, cached: false, data });
  } catch (e: any) {
    console.error('Import product error:', e);
    console.error('Error stack:', e?.stack);
    return NextResponse.json({
      error: e?.message || 'Unknown error',
      details: e?.toString()
    }, { status: 500 });
  }
}
