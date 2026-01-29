export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import Anthropic from '@anthropic-ai/sdk';

export const runtime = 'nodejs';

const anthropic = new Anthropic();

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
 * POST /api/import/product
 * Uses AI with web search to extract product information from a URL
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string })?.id;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('Import product API called');
    const { url } = await req.json();
    console.log('URL received:', url);

    if (!url) {
      return NextResponse.json({ error: 'Missing url' }, { status: 400 });
    }

    // Use Claude with web search to extract product information from the URL
    const response = await anthropic.messages.create({
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
          content: `You are a product data extraction assistant. Visit and analyze this product URL to extract complete product information:

URL: ${url}

Search for and extract all available information about this product:
1. Product name/title
2. Brand/manufacturer
3. Price (in USD, as a number without currency symbol)
4. SKU or model number
5. Product description
6. Product image URL (the main product image, not thumbnails)
7. Dimensions (width, depth, height in inches)
8. Vendor/retailer name (from the website selling it)

Return ONLY a valid JSON object with the extracted information:
{
  "title": "exact product name",
  "brand": "brand name",
  "vendorName": "retailer/website name",
  "sku": "SKU or model number",
  "price": 1299.00,
  "currency": "USD",
  "url": "${url}",
  "imageUrl": "direct URL to main product image",
  "description": "product description",
  "dimensions": {
    "width": 84,
    "depth": 38,
    "height": 32
  },
  "confidence": "high" | "medium" | "low"
}

If you cannot find specific information, omit that field rather than guessing. Include confidence level based on how much information was found.`,
        },
      ],
    });

    // Extract text from response
    let text = '';
    for (const block of response.content) {
      if (block.type === 'text') {
        text += block.text;
      }
    }

    console.log('AI response text:', text.substring(0, 500));

    // Parse JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      // Log unsuccessful import
      await logProductSearch({
        userId,
        searchType: 'URL_IMPORT',
        searchQuery: url,
        wasSuccessful: false,
        resultData: { noJsonResponse: true },
      });

      return NextResponse.json(
        { error: 'Could not extract product information from URL', data: null },
        { status: 200 }
      );
    }

    const productData = JSON.parse(jsonMatch[0]);

    // Log successful import
    await logProductSearch({
      userId,
      searchType: 'URL_IMPORT',
      brandName: productData.brand || productData.vendorName,
      productName: productData.title,
      searchQuery: url,
      wasSuccessful: true,
      resultData: {
        confidence: productData.confidence,
        foundPrice: !!productData.price,
        foundDimensions: !!productData.dimensions,
        foundImage: !!productData.imageUrl,
      },
    });

    // Format response to match expected structure
    const data = {
      title: productData.title || '',
      description: productData.description || '',
      imageUrl: productData.imageUrl || '',
      sku: productData.sku || '',
      brand: productData.brand || '',
      vendorName: productData.vendorName || '',
      url: productData.url || url,
      price: productData.price,
      currency: productData.currency || 'USD',
      dimensions: productData.dimensions,
    };

    console.log('Extracted data:', {
      title: data.title,
      description: data.description,
      imageUrl: data.imageUrl,
      sku: data.sku,
      brand: data.brand,
      vendorName: data.vendorName,
      price: data.price,
      currency: data.currency,
      dimensions: data.dimensions,
    });

    return NextResponse.json({ ok: true, data });
  } catch (e: any) {
    console.error('Import product error:', e);
    console.error('Error stack:', e?.stack);
    return NextResponse.json({
      error: e?.message || 'Unknown error',
      details: e?.toString()
    }, { status: 500 });
  }
}
