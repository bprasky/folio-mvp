import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import Anthropic from '@anthropic-ai/sdk';

export const runtime = 'nodejs';

const anthropic = new Anthropic();

/**
 * POST /api/ai/find-in-folio
 * Searches within Folio's existing product database (Selections) to find matching products
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string })?.id;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { productName, description, imageUrl, category } = body;

    if (!productName && !description) {
      return NextResponse.json(
        { error: 'Need at least a product name or description to search' },
        { status: 400 }
      );
    }

    // Build search terms
    const searchTerms = [productName, description]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    // Extract keywords for search
    const keywords = searchTerms
      .split(/\s+/)
      .filter(word => word.length > 2)
      .slice(0, 10);

    console.log('Folio search keywords:', keywords);

    // Search in Folio's Selections table
    // Look for products with similar names, vendors, or descriptions
    const candidates = await prisma.selection.findMany({
      where: {
        OR: [
          // Search by product name
          {
            productName: {
              contains: productName || '',
              mode: 'insensitive',
            },
          },
          // Search by vendor name
          {
            vendorName: {
              contains: productName?.split(' ')[0] || '',
              mode: 'insensitive',
            },
          },
          // Search in notes/description
          {
            notes: {
              contains: productName || '',
              mode: 'insensitive',
            },
          },
        ],
        // Ensure the candidate has useful spec data
        AND: {
          OR: [
            { unitPrice: { not: null } },
            { vendorName: { not: null } },
            { productUrl: { not: null } },
          ],
        },
      },
      select: {
        id: true,
        productName: true,
        vendorName: true,
        photo: true,
        productUrl: true,
        unitPrice: true,
        vendorProductId: true,
        notes: true,
        uiMeta: true,
        tags: true,
      },
      take: 20, // Get top candidates
    });

    console.log(`Found ${candidates.length} candidate products in Folio`);

    if (candidates.length === 0) {
      return NextResponse.json({
        success: true,
        data: { match: null, candidates: [] },
        message: 'No matching products found in Folio database',
      });
    }

    // If we have only a few candidates, use AI to rank them
    if (candidates.length > 0) {
      // Use Claude to find the best match
      const candidateList = candidates.map((c, i) =>
        `${i + 1}. "${c.productName}" by ${c.vendorName || 'Unknown'} - ${c.notes?.substring(0, 100) || 'No description'}`
      ).join('\n');

      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: `You are helping match interior design products.

The user is looking for: "${productName || description}"
${category ? `Category: ${category}` : ''}

Here are products from our database:
${candidateList}

Which product is the BEST match? Consider:
1. Product name similarity
2. Category match
3. Brand/vendor relevance

Return ONLY a JSON object:
{
  "bestMatchIndex": <1-based index of best match, or 0 if none are good>,
  "confidence": "high" | "medium" | "low",
  "reason": "brief explanation"
}`,
          },
        ],
      });

      // Extract response
      let text = '';
      for (const block of response.content) {
        if (block.type === 'text') {
          text += block.text;
        }
      }

      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const matchResult = JSON.parse(jsonMatch[0]);

        if (matchResult.bestMatchIndex > 0 && matchResult.bestMatchIndex <= candidates.length) {
          const bestMatch = candidates[matchResult.bestMatchIndex - 1];

          // Parse dimensions from uiMeta if available
          const uiMeta = bestMatch.uiMeta as { dimensions?: { width?: number; depth?: number; height?: number } } | null;

          return NextResponse.json({
            success: true,
            data: {
              match: {
                id: bestMatch.id,
                productName: bestMatch.productName,
                vendorName: bestMatch.vendorName,
                brand: bestMatch.vendorName,
                sku: bestMatch.vendorProductId,
                unitPrice: bestMatch.unitPrice,
                productUrl: bestMatch.productUrl,
                photo: bestMatch.photo,
                dimensions: uiMeta?.dimensions,
              },
              confidence: matchResult.confidence,
              reason: matchResult.reason,
            },
          });
        }
      }
    }

    // No good match found
    return NextResponse.json({
      success: true,
      data: { match: null, candidates: candidates.slice(0, 5) },
      message: 'No strong match found. Showing possible candidates.',
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('Folio search failed:', errorMsg);
    return NextResponse.json(
      { error: 'Folio search failed', details: errorMsg },
      { status: 500 }
    );
  }
}
