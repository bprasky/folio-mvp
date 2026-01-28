export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * POST /api/projects/[id]/images/[imageId]/suggest-tags
 *
 * Uses Gemini Vision to analyze a generated image and suggest
 * product tag positions based on the selections used to generate it.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; imageId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: projectId, imageId } = params;

    // Verify GEMINI_API_KEY is available
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Gemini API key not configured' },
        { status: 500 }
      );
    }

    // Get the image and verify project ownership
    const image = await prisma.projectImage.findFirst({
      where: {
        id: imageId,
        projectId: projectId,
      },
    });

    if (!image) {
      return NextResponse.json({ error: 'Image not found' }, { status: 404 });
    }

    // Parse metadata to get the selections that were used
    let metadata: any;
    try {
      metadata = typeof image.name === 'string' ? JSON.parse(image.name) : image.name;
    } catch {
      return NextResponse.json(
        { error: 'No generation metadata found' },
        { status: 400 }
      );
    }

    if (metadata?.type !== 'GENERATED' || !metadata?.contextJSON?.selections) {
      return NextResponse.json(
        { error: 'Image was not AI-generated or missing context' },
        { status: 400 }
      );
    }

    const selections = metadata.contextJSON.selections as Array<{
      id: string;
      role: string;
      line: string;
      category?: string;
    }>;

    if (selections.length === 0) {
      return NextResponse.json({
        imageId,
        suggestions: [],
        message: 'No selections to tag',
      });
    }

    // Fetch the image as base64
    const imageResponse = await fetch(image.url);
    if (!imageResponse.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch image' },
        { status: 500 }
      );
    }

    const imageBuffer = await imageResponse.arrayBuffer();
    const imageBase64 = Buffer.from(imageBuffer).toString('base64');
    const mimeType = imageResponse.headers.get('content-type') || 'image/png';

    // Use Gemini Vision to estimate product locations
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

    const productList = selections.map((s) => s.role).join(', ');
    const selectionMapping = selections.map((s) => ({
      role: s.role,
      id: s.id,
      description: s.line,
    }));

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType,
          data: imageBase64,
        },
      },
      {
        text: `You are analyzing an AI-generated interior design render. This image was created using the following products: ${productList}.

For each product you can identify in the image, estimate its CENTER position as x,y coordinates on a 0-100 scale where:
- (0, 0) is the top-left corner
- (100, 100) is the bottom-right corner

The x coordinate increases from left to right.
The y coordinate increases from top to bottom.

Here are the products to find (with their selection IDs):
${JSON.stringify(selectionMapping, null, 2)}

Return ONLY valid JSON in this exact format, no other text or markdown:
{
  "suggestions": [
    { "role": "sofa", "selectionId": "abc123", "x": 50, "y": 60, "confidence": 0.9, "reasoning": "large sofa visible in center-left of image" }
  ]
}

Rules:
1. Only include items you can clearly identify (confidence > 0.6)
2. Use the exact selectionId from the list above
3. Provide a brief reasoning for each suggestion
4. If a product is not visible or you're unsure, omit it from the array
5. Position should be the visual center of where the product appears`,
      },
    ]);

    const responseText = result.response.text();

    // Parse the JSON response
    let suggestions: Array<{
      role: string;
      selectionId: string;
      x: number;
      y: number;
      confidence: number;
      reasoning?: string;
    }> = [];

    try {
      // Extract JSON from response (handle markdown code blocks)
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        suggestions = parsed.suggestions || [];
      }
    } catch (e) {
      console.error('[suggest-tags] Failed to parse response:', e, responseText);
    }

    // Filter to high-confidence suggestions and normalize coordinates
    const validSuggestions = suggestions
      .filter(
        (s) =>
          s.confidence >= 0.6 &&
          s.x >= 0 &&
          s.x <= 100 &&
          s.y >= 0 &&
          s.y <= 100 &&
          // Verify selectionId is valid
          selections.some((sel) => sel.id === s.selectionId)
      )
      .map((s) => ({
        ...s,
        // Normalize to 0-1 range for ProductTag model
        x: s.x / 100,
        y: s.y / 100,
      }));

    return NextResponse.json({
      imageId,
      suggestions: validSuggestions,
      rawSelections: selections,
      totalFound: validSuggestions.length,
      totalExpected: selections.length,
    });
  } catch (error: any) {
    console.error('[suggest-tags] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to suggest tags' },
      { status: 500 }
    );
  }
}
