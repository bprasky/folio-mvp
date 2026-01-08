import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { analyzeImage, shouldAnalyzeImage } from '@/lib/import-agent';
import { searchProductAttribution } from '@/lib/import-agent';

/**
 * POST /api/import/analyze
 * Analyze a single image (for preview/testing)
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string })?.id;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { imageUrl, includeAttribution = false, roomHint, projectStyle } = body;

    if (!imageUrl) {
      return NextResponse.json(
        { error: 'imageUrl is required' },
        { status: 400 }
      );
    }

    // Check if image should be analyzed
    const imageSource = { type: 'url' as const, url: imageUrl };
    const checkResult = await shouldAnalyzeImage(imageSource);

    if (!checkResult.shouldAnalyze) {
      return NextResponse.json({
        shouldAnalyze: false,
        reason: checkResult.reason,
        analysis: null,
      });
    }

    // Analyze the image
    const analysis = await analyzeImage(imageSource, { roomHint, projectStyle });

    // Optionally search for product attributions
    let productsWithAttributions = analysis.products;
    if (includeAttribution && analysis.products.length > 0) {
      productsWithAttributions = await Promise.all(
        analysis.products.map(async (product) => {
          const attributions = await searchProductAttribution(product);
          return {
            ...product,
            attributions,
            topAttribution: attributions[0] || null,
          };
        })
      );
    }

    return NextResponse.json({
      shouldAnalyze: true,
      reason: checkResult.reason,
      analysis: {
        ...analysis,
        products: productsWithAttributions,
      },
    });
  } catch (error) {
    console.error('Error analyzing image:', error);
    return NextResponse.json(
      { error: 'Failed to analyze image' },
      { status: 500 }
    );
  }
}
