import { prisma } from "@/lib/prisma";

export type UpsertProductInput = {
  url: string;
  sourceType: string;       // "material_bank" | "vendor_site" | "other"
  origin: string;           // "designer_scrape" | "demo_seed" | "vendor_upload"
};

export type ScrapedProductData = {
  name: string;
  description?: string | null;
  primaryImageUrl?: string | null;
  imageUrls?: string[];
  price?: number | null;
  priceCurrency?: string | null;
  priceRangeText?: string | null;
  specsJson?: any;
  brand?: string | null;
  category?: string | null;
};

/**
 * Scrapes product data from a URL
 * This function imports and uses the scraping logic directly
 */
async function scrapeProductFromUrl(url: string): Promise<ScrapedProductData> {
  try {
    // Import the scraping function from the API route
    // For now, we'll make a server-side fetch to the API endpoint
    // In production, you might want to extract the scraping logic to a shared module
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000';
    const response = await fetch(`${baseUrl}/api/scrape-product`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
      // Use internal fetch for server-side calls
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`Failed to scrape product: ${response.statusText}`);
    }

    const data = await response.json();

    // Parse price string to number if needed
    let price: number | null = null;
    if (data.price) {
      const priceStr = String(data.price).replace(/[^\d.]/g, '');
      price = parseFloat(priceStr) || null;
    }

    // Extract primary image
    const primaryImageUrl = data.image || data.imageUrl || null;
    const imageUrls = Array.isArray(data.imageUrls) 
      ? data.imageUrls 
      : primaryImageUrl 
        ? [primaryImageUrl] 
        : [];

    // Build specs JSON from available data
    const specsJson: any = {};
    if (data.dimensions) specsJson.dimensions = data.dimensions;
    if (data.materials && Array.isArray(data.materials)) specsJson.materials = data.materials;
    if (data.colors && Array.isArray(data.colors)) specsJson.colors = data.colors;
    if (data.tags && Array.isArray(data.tags)) specsJson.tags = data.tags;

    return {
      name: data.name || 'Untitled Product',
      description: data.description || null,
      primaryImageUrl,
      imageUrls,
      price,
      priceCurrency: 'USD', // Default to USD, can be extracted from price string if needed
      priceRangeText: data.price || null,
      specsJson: Object.keys(specsJson).length > 0 ? specsJson : null,
      brand: data.brand || null,
      category: data.category || null,
    };
  } catch (error) {
    console.error('Error scraping product from URL:', error);
    // Return minimal data on error
    return {
      name: 'Untitled Product',
      description: null,
      primaryImageUrl: null,
      imageUrls: [],
      price: null,
      priceCurrency: null,
      priceRangeText: null,
      specsJson: null,
      brand: null,
      category: null,
    };
  }
}

/**
 * Upserts a product from a scraped URL
 * Checks if product exists by sourceUrl, creates if not
 */
export async function upsertProductFromScrape(input: UpsertProductInput) {
  const { url, sourceType, origin } = input;

  // 1. Check if product already exists by sourceUrl
  const existing = await prisma.product.findUnique({
    where: { sourceUrl: url },
  });

  if (existing) {
    return existing;
  }

  // 2. Scrape fresh data
  const scraped = await scrapeProductFromUrl(url);

  // 3. Create new product
  const product = await prisma.product.create({
    data: {
      sourceUrl: url,
      sourceType,
      origin,
      name: scraped.name ?? "Untitled Product",
      description: scraped.description ?? null,
      primaryImageUrl: scraped.primaryImageUrl ?? null,
      imageUrls: scraped.imageUrls ?? [],
      price: scraped.price ?? null,
      priceCurrency: scraped.priceCurrency ?? null,
      priceRangeText: scraped.priceRangeText ?? null,
      specsJson: scraped.specsJson ?? null,
      status: "draft",
      // Map existing fields
      imageUrl: scraped.primaryImageUrl ?? null,
      brand: scraped.brand ?? null,
      category: scraped.category ?? null,
      url: url, // Keep the old url field for backward compatibility
    },
  });

  return product;
}

