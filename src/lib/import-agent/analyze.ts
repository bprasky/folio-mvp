import { anthropic, IMPORT_AGENT_CONFIG, IMPORT_AGENT_SYSTEM } from './config';
import type { RoomAnalysis, DetectedProduct, AnalysisContext, ProductCategory, RoomType, ConfidenceLevel } from './types';

// Type for PDF analysis result with multiple pages
export interface PdfAnalysisResult {
  pages: Array<{
    pageNumber: number;
    roomType: RoomType;
    products: DetectedProduct[];
    styleIndicators: string[];
  }>;
  documentSummary: {
    totalPages: number;
    interiorPages: number;
    dominantStyles: string[];
  };
}

/**
 * Analyze an interior design image to detect room type and products
 */
export async function analyzeImage(
  imageSource: { type: 'base64'; data: string; mediaType: string } | { type: 'url'; url: string },
  context?: AnalysisContext
): Promise<RoomAnalysis> {
  const emptyResult: RoomAnalysis = {
    roomType: 'other',
    products: [],
    styleIndicators: [],
    dominantColors: [],
    materials: [],
  };

  try {
    const imageContent = imageSource.type === 'base64'
      ? {
          type: 'image' as const,
          source: {
            type: 'base64' as const,
            media_type: imageSource.mediaType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
            data: imageSource.data,
          },
        }
      : {
          type: 'image' as const,
          source: {
            type: 'url' as const,
            url: imageSource.url,
          },
        };

    const response = await anthropic.messages.create({
      model: IMPORT_AGENT_CONFIG.model,
      max_tokens: IMPORT_AGENT_CONFIG.maxTokens,
      system: IMPORT_AGENT_SYSTEM,
      messages: [
        {
          role: 'user',
          content: [
            imageContent,
            {
              type: 'text',
              text: `Analyze this interior design image.
${context?.roomHint ? `Room hint: ${context.roomHint}` : ''}
${context?.projectStyle ? `Project style: ${context.projectStyle}` : ''}

Return ONLY a valid JSON object with this structure:
{
  "roomType": "living_room" | "bedroom" | "kitchen" | "bathroom" | "dining_room" | "office" | "entry" | "outdoor" | "hallway" | "laundry" | "closet" | "other",
  "products": [
    {
      "description": "detailed description for search (e.g., 'Navy velvet sofa with brass legs')",
      "category": "FURNITURE" | "LIGHTING" | "RUG" | "ART" | "FIXTURES" | "MATERIALS" | "TEXTILES" | "ACCESSORIES" | "HARDWARE" | "APPLIANCES" | "OTHER",
      "position": { "x": 0.0-1.0, "y": 0.0-1.0 },
      "confidence": "high" | "medium" | "low",
      "searchQuery": "optimized search terms for finding this product"
    }
  ],
  "styleIndicators": ["style1", "style2"],
  "dominantColors": ["color1", "color2"],
  "materials": ["material1", "material2"]
}

Focus on major furniture pieces, lighting fixtures, rugs, art, and notable design elements.
Position coordinates should be normalized (0-1) representing the center of where a tag should appear.
Maximum ${IMPORT_AGENT_CONFIG.maxProductsPerImage} products per image.
Be conservative with confidence - only use "high" when the product is clearly identifiable.`,
            },
          ],
        },
      ],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        roomType: validateRoomType(parsed.roomType),
        products: (parsed.products || []).map(validateProduct).filter(Boolean) as DetectedProduct[],
        styleIndicators: parsed.styleIndicators || [],
        dominantColors: parsed.dominantColors || [],
        materials: parsed.materials || [],
      };
    }

    return emptyResult;
  } catch (error) {
    console.error('Image analysis failed:', error);
    return emptyResult;
  }
}

/**
 * Check if an image is likely a content slide vs a title/text slide
 */
export async function shouldAnalyzeImage(
  imageSource: { type: 'base64'; data: string; mediaType: string } | { type: 'url'; url: string }
): Promise<{ shouldAnalyze: boolean; reason: string }> {
  try {
    const imageContent = imageSource.type === 'base64'
      ? {
          type: 'image' as const,
          source: {
            type: 'base64' as const,
            media_type: imageSource.mediaType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
            data: imageSource.data,
          },
        }
      : {
          type: 'image' as const,
          source: {
            type: 'url' as const,
            url: imageSource.url,
          },
        };

    const response = await anthropic.messages.create({
      model: IMPORT_AGENT_CONFIG.model,
      max_tokens: 256,
      messages: [
        {
          role: 'user',
          content: [
            imageContent,
            {
              type: 'text',
              text: `Is this an interior design photo that shows a room or space with products/furniture?
Return JSON: { "isInteriorPhoto": true/false, "reason": "brief explanation" }
Skip title slides, text-only slides, floor plans, mood boards without real products, and non-interior images.`,
            },
          ],
        },
      ],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const jsonMatch = text.match(/\{[\s\S]*?\}/);

    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        shouldAnalyze: parsed.isInteriorPhoto === true,
        reason: parsed.reason || '',
      };
    }

    return { shouldAnalyze: true, reason: 'Unable to determine, will analyze' };
  } catch (error) {
    console.error('Image check failed:', error);
    return { shouldAnalyze: true, reason: 'Error checking, will analyze' };
  }
}

// Validation helpers
function validateRoomType(value: unknown): RoomType {
  const validTypes: RoomType[] = [
    'living_room', 'bedroom', 'kitchen', 'bathroom', 'dining_room',
    'office', 'entry', 'outdoor', 'hallway', 'laundry', 'closet', 'other'
  ];
  if (typeof value === 'string' && validTypes.includes(value as RoomType)) {
    return value as RoomType;
  }
  return 'other';
}

function validateProduct(product: unknown): DetectedProduct | null {
  if (!product || typeof product !== 'object') return null;

  const p = product as Record<string, unknown>;

  const validCategories: ProductCategory[] = [
    'FURNITURE', 'LIGHTING', 'RUG', 'ART', 'FIXTURES',
    'MATERIALS', 'TEXTILES', 'ACCESSORIES', 'HARDWARE', 'APPLIANCES', 'OTHER'
  ];

  const validConfidence: ConfidenceLevel[] = ['high', 'medium', 'low'];

  if (typeof p.description !== 'string' || !p.description) return null;

  const position = p.position as { x?: number; y?: number } | undefined;

  return {
    description: p.description,
    category: validCategories.includes(p.category as ProductCategory)
      ? (p.category as ProductCategory)
      : 'OTHER',
    position: {
      x: typeof position?.x === 'number' ? Math.max(0, Math.min(1, position.x)) : 0.5,
      y: typeof position?.y === 'number' ? Math.max(0, Math.min(1, position.y)) : 0.5,
    },
    confidence: validConfidence.includes(p.confidence as ConfidenceLevel)
      ? (p.confidence as ConfidenceLevel)
      : 'low',
    searchQuery: typeof p.searchQuery === 'string' ? p.searchQuery : p.description,
  };
}

/**
 * Analyze a PDF document directly using Claude's document API
 * This avoids the need for PDF-to-image conversion
 */
export async function analyzePdfDocument(pdfUrl: string): Promise<PdfAnalysisResult> {
  const emptyResult: PdfAnalysisResult = {
    pages: [],
    documentSummary: {
      totalPages: 0,
      interiorPages: 0,
      dominantStyles: [],
    },
  };

  try {
    console.log(`Analyzing PDF document: ${pdfUrl.substring(0, 100)}...`);

    // Fetch the PDF with aggressive timeout
    const controller = new AbortController();
    const fetchTimeout = setTimeout(() => {
      console.log('PDF fetch timeout - aborting');
      controller.abort();
    }, 15000); // 15 second timeout for fetch

    let response: Response;
    try {
      response = await fetch(pdfUrl, { signal: controller.signal });
      clearTimeout(fetchTimeout);
    } catch (fetchError) {
      clearTimeout(fetchTimeout);
      console.error('PDF fetch failed:', fetchError);
      throw new Error(`Failed to fetch PDF: ${fetchError instanceof Error ? fetchError.message : 'Network error'}`);
    }

    if (!response.ok) {
      throw new Error(`Failed to fetch PDF: ${response.status} ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const fileSizeKB = Math.round(arrayBuffer.byteLength / 1024);
    const fileSizeMB = fileSizeKB / 1024;

    console.log(`PDF fetched successfully, size: ${fileSizeKB}KB (${fileSizeMB.toFixed(2)}MB)`);

    // Check size limit
    if (fileSizeMB > 25) {
      throw new Error(`PDF file is too large (${fileSizeMB.toFixed(2)}MB). Maximum is 25MB.`);
    }

    const base64Data = Buffer.from(arrayBuffer).toString('base64');

    console.log(`Starting Claude document analysis (this may take 1-2 minutes)...`);

    // Use Claude's document API with 2 minute timeout
    const apiTimeout = 120000; // 2 minutes
    let timeoutId: NodeJS.Timeout;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        console.log('Claude API timeout reached');
        reject(new Error('Claude API timeout after 2 minutes'));
      }, apiTimeout);
    });

    try {
      const result = await Promise.race([
        anthropic.messages.create({
          model: IMPORT_AGENT_CONFIG.model,
          max_tokens: 8192,
          system: IMPORT_AGENT_SYSTEM,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'document',
                  source: {
                    type: 'base64',
                    media_type: 'application/pdf',
                    data: base64Data,
                  },
                },
                {
                  type: 'text',
                  text: `Analyze this interior design presentation PDF.

For each page that contains an interior design photo (skip title slides, text-only pages, floor plans):

1. Identify the room type
2. Detect all visible products (furniture, lighting, rugs, art, etc.)
3. Note style indicators

Return ONLY a valid JSON object with this structure:
{
  "pages": [
    {
      "pageNumber": 1,
      "roomType": "living_room" | "bedroom" | "kitchen" | "bathroom" | "dining_room" | "office" | "entry" | "outdoor" | "hallway" | "laundry" | "closet" | "other",
      "products": [
        {
          "description": "detailed description for search (e.g., 'Navy velvet sofa with brass legs')",
          "category": "FURNITURE" | "LIGHTING" | "RUG" | "ART" | "FIXTURES" | "MATERIALS" | "TEXTILES" | "ACCESSORIES" | "HARDWARE" | "APPLIANCES" | "OTHER",
          "position": { "x": 0.0-1.0, "y": 0.0-1.0 },
          "confidence": "high" | "medium" | "low",
          "searchQuery": "optimized search terms"
        }
      ],
      "styleIndicators": ["modern", "minimalist"]
    }
  ],
  "documentSummary": {
    "totalPages": 10,
    "interiorPages": 7,
    "dominantStyles": ["modern", "scandinavian"]
  }
}

Rules:
- Only include pages with actual interior photos
- Maximum ${IMPORT_AGENT_CONFIG.maxProductsPerImage} products per page
- Position coordinates should be normalized (0-1)
- Be conservative with confidence levels`,
                },
              ],
            },
          ],
        }),
        timeoutPromise,
      ]);

      clearTimeout(timeoutId!);
      console.log('Claude API response received');

      const text = result.content[0].type === 'text' ? result.content[0].text : '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);

        const validatedPages = (parsed.pages || [])
          .filter((page: unknown) => page && typeof page === 'object')
          .map((page: Record<string, unknown>) => ({
            pageNumber: typeof page.pageNumber === 'number' ? page.pageNumber : 1,
            roomType: validateRoomType(page.roomType),
            products: (Array.isArray(page.products) ? page.products : [])
              .map(validateProduct)
              .filter(Boolean) as DetectedProduct[],
            styleIndicators: Array.isArray(page.styleIndicators) ? page.styleIndicators : [],
          }));

        console.log(`PDF analysis complete: ${validatedPages.length} pages with content`);

        return {
          pages: validatedPages,
          documentSummary: {
            totalPages: parsed.documentSummary?.totalPages || 0,
            interiorPages: validatedPages.length,
            dominantStyles: parsed.documentSummary?.dominantStyles || [],
          },
        };
      }

      console.log('No valid JSON found in PDF analysis response');
      return emptyResult;
    } catch (apiError) {
      clearTimeout(timeoutId!);
      throw apiError;
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('PDF document analysis failed:', errorMsg);
    // Re-throw so the caller knows it failed
    throw new Error(`PDF analysis failed: ${errorMsg}`);
  }
}
