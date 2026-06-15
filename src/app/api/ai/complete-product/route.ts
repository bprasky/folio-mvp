import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import Anthropic from '@anthropic-ai/sdk';
import { MODELS } from '@/lib/ai/models';

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
 * POST /api/ai/complete-product
 * Uses AI with web search to find and complete missing product specifications
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string })?.id;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { productName, vendorName, description, imageUrl, existingData, selectionId, projectId } = body;

    if (!productName && !vendorName && !description) {
      return NextResponse.json(
        { error: 'Need at least a product name, vendor, or description' },
        { status: 400 }
      );
    }

    // Build search context from what we know
    const searchContext = [
      productName && `Product: ${productName}`,
      vendorName && `Brand/Vendor: ${vendorName}`,
      description && `Description: ${description}`,
      existingData?.sku && `SKU: ${existingData.sku}`,
    ].filter(Boolean).join('\n');

    console.log('AI Complete Product - Search context:', searchContext);

    const response = await anthropic.messages.create({
      model: MODELS.sonnet,
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
          content: `You are a product research assistant for interior designers. Find complete product specifications for this item:

${searchContext}

Search for this product on furniture/design vendor websites and find:
1. Full product name
2. Brand/manufacturer
3. Vendor/retailer
4. Price (in USD)
5. Dimensions (width, depth, height in inches)
6. SKU or model number
7. Product URL
8. Material/finish information

Prioritize reputable design vendors like:
- RH (Restoration Hardware)
- Pottery Barn
- West Elm
- CB2
- Design Within Reach
- Article
- Wayfair
- Arhaus
- Crate & Barrel

Return ONLY a valid JSON object with the found information:
{
  "productName": "exact product name",
  "brand": "brand name",
  "vendorName": "retailer name",
  "sku": "SKU or model number",
  "price": 1299.00,
  "productUrl": "https://...",
  "imageUrl": "product image URL if found",
  "description": "brief product description",
  "dimensions": {
    "width": 84,
    "depth": 38,
    "height": 32
  },
  "materials": "material description",
  "confidence": "high" | "medium" | "low",
  "source": "where the info was found"
}

If you cannot find specific information, omit that field. Include confidence level based on match quality.`,
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
      // Log unsuccessful AI search
      await logProductSearch({
        userId,
        searchType: 'AI_COMPLETE',
        brandName: vendorName,
        productName,
        searchQuery: searchContext,
        selectionId,
        projectId,
        wasSuccessful: false,
        resultData: { noJsonResponse: true },
      });

      return NextResponse.json(
        { error: 'Could not find product information', data: null },
        { status: 200 }
      );
    }

    const productData = JSON.parse(jsonMatch[0]);

    // Log successful AI search
    await logProductSearch({
      userId,
      searchType: 'AI_COMPLETE',
      brandName: productData.brand || productData.vendorName || vendorName,
      productName: productData.productName || productName,
      searchQuery: searchContext,
      selectionId,
      projectId,
      wasSuccessful: true,
      resultData: {
        confidence: productData.confidence,
        source: productData.source,
        foundPrice: !!productData.price,
        foundDimensions: !!productData.dimensions,
        foundUrl: !!productData.productUrl,
      },
    });

    return NextResponse.json({
      success: true,
      data: productData,
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('AI complete product failed:', errorMsg);
    return NextResponse.json(
      { error: 'AI search failed', details: errorMsg },
      { status: 500 }
    );
  }
}
