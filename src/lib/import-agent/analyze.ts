import { anthropic, IMPORT_AGENT_CONFIG, IMPORT_AGENT_SYSTEM } from './config';
import type { RoomAnalysis, DetectedProduct, AnalysisContext, ProductCategory, RoomType, ConfidenceLevel } from './types';

// Extracted specs from visible text on a page (not tied to specific products)
export interface PageExtractedSpecs {
  vendors: string[];      // ["Serena & Lily", "RH"]
  prices: string[];       // ["$1,299", "$2,500"]
  dimensions: string[];   // ["72W x 36D x 30H"]
  skus: string[];         // ["SKU12345"]
  productNames: string[]; // ["Harbor Sofa", "Luna Chair"]
}

// Type for PDF analysis result with multiple pages
export interface PdfAnalysisResult {
  pages: Array<{
    pageNumber: number;
    roomType: RoomType;
    roomName?: string; // e.g. "Primary Bedroom" from title slides
    products: DetectedProduct[];
    styleIndicators: string[];
    extractedSpecs?: PageExtractedSpecs; // Specs visible on this page
  }>;
  documentSummary: {
    totalPages: number;
    interiorPages: number;
    dominantStyles: string[];
    roomsDetected?: string[];
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
  "roomConfidence": "high" | "medium" | "low",
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

"roomConfidence" reflects how sure you are about the room type — use "low" for cropped detail shots or ambiguous spaces.
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
        roomConfidence: validateConfidence(parsed.roomConfidence),
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

/**
 * Analyze multiple interior design images in a single Claude API call.
 * Dramatically reduces API calls vs per-image analysis (1 call per batch vs 2N calls).
 * Images are processed in batches of IMPORT_AGENT_CONFIG.maxImagesPerBatch.
 */
export async function analyzeImagesBatch(
  images: Array<{ id: string; url: string }>,
  context?: AnalysisContext
): Promise<Map<string, RoomAnalysis>> {
  const resultMap = new Map<string, RoomAnalysis>();
  if (images.length === 0) return resultMap;

  // For a single image, use regular function
  if (images.length === 1) {
    const analysis = await analyzeImage({ type: 'url', url: images[0].url }, context);
    resultMap.set(images[0].id, analysis);
    return resultMap;
  }

  // Process in batches
  const batchSize = IMPORT_AGENT_CONFIG.maxImagesPerBatch;
  for (let i = 0; i < images.length; i += batchSize) {
    const batch = images.slice(i, i + batchSize);

    try {
      const batchResults = await _analyzeImageBatchSingle(batch, context);
      for (const [id, analysis] of batchResults) {
        resultMap.set(id, analysis);
      }
    } catch (error) {
      console.error(`[analyzeImagesBatch] Batch ${Math.floor(i / batchSize) + 1} failed:`, error);
      // Continue with next batch rather than failing everything
    }
  }

  return resultMap;
}

/**
 * Internal: analyze a single batch of images (up to maxImagesPerBatch) in one Claude call.
 */
async function _analyzeImageBatchSingle(
  images: Array<{ id: string; url: string }>,
  context?: AnalysisContext
): Promise<Map<string, RoomAnalysis>> {
  const resultMap = new Map<string, RoomAnalysis>();

  const content: Array<
    | { type: 'image'; source: { type: 'url'; url: string } }
    | { type: 'text'; text: string }
  > = [];

  for (let i = 0; i < images.length; i++) {
    content.push({
      type: 'image' as const,
      source: { type: 'url' as const, url: images[i].url },
    });
    content.push({
      type: 'text' as const,
      text: `[Image ${i + 1}]`,
    });
  }

  content.push({
    type: 'text' as const,
    text: `Analyze all ${images.length} interior design images above.
${context?.projectStyle ? `Project style: ${context.projectStyle}` : ''}

For EACH image, detect the room type and products. If an image is NOT an interior design photo (e.g. title slide, text-only, floor plan, mood board), set "skip": true.

ROOM IDENTITY — read carefully:
- "roomGroup": a short id (e.g. "g1", "g2") shared by every photo of the SAME physical room. Multiple angles/details of one room share one roomGroup. Two genuinely different rooms of the same type (e.g. a primary bathroom and a powder room) MUST get different roomGroup ids. Decide by fixtures, finishes, layout, scale, and window/view — not just room type.
- "roomLabel": a specific, article-ready name for that room ("Primary Bathroom", "Powder Room", "Pool Bath", "Kitchen", "Front Exterior"). Photos in the same roomGroup MUST share the same roomLabel. Be specific when you can tell rooms apart; if you truly cannot, a plain type name is fine and we will number duplicates.
- "roomConfidence": how sure you are about the room call ("high" | "medium" | "low"). Use "high" only when the room type is unmistakable. Use "low" for cropped detail shots, ambiguous spaces, or anything you're guessing — those photos will be left for the designer to sort by hand instead of auto-filed.

Return ONLY a valid JSON object:
{
  "images": [
    {
      "index": 1,
      "skip": false,
      "roomType": "living_room" | "bedroom" | "kitchen" | "bathroom" | "dining_room" | "office" | "entry" | "outdoor" | "hallway" | "laundry" | "closet" | "other",
      "roomGroup": "g1",
      "roomLabel": "Primary Bathroom",
      "roomConfidence": "high" | "medium" | "low",
      "products": [
        {
          "description": "detailed description (e.g., 'Navy velvet sofa with brass legs')",
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
  ]
}

Focus on major furniture, lighting, rugs, art, and notable design elements.
Position coordinates: normalized 0-1, representing center of where tag should appear.
Maximum ${IMPORT_AGENT_CONFIG.maxProductsPerImage} products per image.
Be conservative with confidence - only use "high" when clearly identifiable.`,
  });

  const response = await anthropic.messages.create({
    model: IMPORT_AGENT_CONFIG.model,
    max_tokens: Math.min(IMPORT_AGENT_CONFIG.maxTokens * images.length, 16384),
    system: IMPORT_AGENT_SYSTEM,
    messages: [{ role: 'user', content }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  const jsonMatch = text.match(/\{[\s\S]*\}/);

  if (jsonMatch) {
    const parsed = JSON.parse(jsonMatch[0]);
    const imageResults = parsed.images || [];

    for (const result of imageResults) {
      const imageIndex = (result.index || 1) - 1;
      const image = images[imageIndex];
      if (!image || result.skip) continue;

      resultMap.set(image.id, {
        roomType: validateRoomType(result.roomType),
        products: (result.products || []).map(validateProduct).filter(Boolean) as DetectedProduct[],
        styleIndicators: result.styleIndicators || [],
        dominantColors: result.dominantColors || [],
        materials: result.materials || [],
        roomLabel: typeof result.roomLabel === 'string' && result.roomLabel.trim()
          ? result.roomLabel.trim()
          : undefined,
        roomGroup: result.roomGroup != null ? String(result.roomGroup) : undefined,
        roomConfidence: validateConfidence(result.roomConfidence),
      });
    }
  }

  return resultMap;
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

// Default to 'low' when the model omits or garbles the field, so an unstated
// confidence falls below the sort threshold and the photo waits for the
// designer rather than being filed on a guess.
function validateConfidence(value: unknown): ConfidenceLevel {
  const valid: ConfidenceLevel[] = ['high', 'medium', 'low'];
  if (typeof value === 'string' && valid.includes(value as ConfidenceLevel)) {
    return value as ConfidenceLevel;
  }
  return 'low';
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

  const result: DetectedProduct = {
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

  // Add extracted spec fields if present
  if (typeof p.extractedVendor === 'string' && p.extractedVendor) {
    result.extractedVendor = p.extractedVendor;
  }
  if (typeof p.extractedPrice === 'string' && p.extractedPrice) {
    result.extractedPrice = p.extractedPrice;
  }
  if (typeof p.extractedDimensions === 'string' && p.extractedDimensions) {
    result.extractedDimensions = p.extractedDimensions;
  }
  if (typeof p.extractedSku === 'string' && p.extractedSku) {
    result.extractedSku = p.extractedSku;
  }
  if (typeof p.extractedProductName === 'string' && p.extractedProductName) {
    result.extractedProductName = p.extractedProductName;
  }

  return result;
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

IMPORTANT: Look for room context in title slides, headers, or section dividers. If a title slide says "Primary Bedroom" or "Living Room", apply that room type to ALL subsequent interior photos until a new room section begins. Interior designers often organize presentations by room.

CRITICAL - TEXT EXTRACTION: Many design PDFs include specification callouts, product labels, or annotation text near products. You MUST extract any visible text that contains:
- Vendor/brand names (e.g., "Serena & Lily", "RH", "Restoration Hardware", "West Elm", "Pottery Barn", "CB2", "Arhaus", "Four Hands", "Visual Comfort", "Kelly Wearstler", "Made Goods")
- Prices (e.g., "$1,299", "2,500 USD", "$899.00")
- Dimensions (e.g., "72W x 36D x 30H", "24\" diameter", "6' x 9'")
- SKU/product codes (e.g., "SKU: 12345", "Item #ABC-123")
- Product names (e.g., "Harbor Sofa", "Luna Chandelier")

For each page that contains an interior design photo:

1. Identify the room type (use context from title slides if the image itself doesn't clearly show the room type)
2. Detect all visible products (furniture, lighting, rugs, art, etc.)
3. EXTRACT any visible text specs and associate them with the nearest product if possible
4. Note style indicators

Return ONLY a valid JSON object with this structure:
{
  "pages": [
    {
      "pageNumber": 1,
      "roomType": "living_room" | "bedroom" | "kitchen" | "bathroom" | "dining_room" | "office" | "entry" | "outdoor" | "hallway" | "laundry" | "closet" | "other",
      "roomName": "Primary Bedroom" or "Living Room" or null,
      "products": [
        {
          "description": "detailed description for search (e.g., 'Navy velvet sofa with brass legs')",
          "category": "FURNITURE" | "LIGHTING" | "RUG" | "ART" | "FIXTURES" | "MATERIALS" | "TEXTILES" | "ACCESSORIES" | "HARDWARE" | "APPLIANCES" | "OTHER",
          "position": { "x": 0.0-1.0, "y": 0.0-1.0 },
          "confidence": "high" | "medium" | "low",
          "searchQuery": "optimized search terms",
          "extractedVendor": "Serena & Lily" or null,
          "extractedPrice": "$1,299" or null,
          "extractedDimensions": "72W x 36D x 30H" or null,
          "extractedSku": "SKU12345" or null,
          "extractedProductName": "Harbor Sofa" or null
        }
      ],
      "styleIndicators": ["modern", "minimalist"],
      "extractedSpecs": {
        "vendors": ["Serena & Lily", "RH"],
        "prices": ["$1,299", "$849"],
        "dimensions": ["72W x 36D x 30H"],
        "skus": [],
        "productNames": ["Harbor Sofa"]
      }
    }
  ],
  "documentSummary": {
    "totalPages": 10,
    "interiorPages": 7,
    "dominantStyles": ["modern", "scandinavian"],
    "roomsDetected": ["Primary Bedroom", "Living Room"]
  }
}

Rules:
- Only include pages with actual interior photos (not title slides, but DO read text from all pages)
- Use room names/labels from title slides to categorize ALL subsequent photos in that section
- Maximum ${IMPORT_AGENT_CONFIG.maxProductsPerImage} products per page
- Position coordinates should be normalized (0-1)
- Be conservative with confidence levels
- ALWAYS extract visible text specs - this is critical for matching products to vendor inventory
- If a spec label is near a product, include it in that product's extracted fields
- Also include ALL specs found on the page in the extractedSpecs array`,
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
          .map((page: Record<string, unknown>) => {
            const extractedSpecs = page.extractedSpecs as Record<string, unknown> | undefined;
            return {
              pageNumber: typeof page.pageNumber === 'number' ? page.pageNumber : 1,
              roomType: validateRoomType(page.roomType),
              roomName: typeof page.roomName === 'string' ? page.roomName : undefined,
              products: (Array.isArray(page.products) ? page.products : [])
                .map(validateProduct)
                .filter(Boolean) as DetectedProduct[],
              styleIndicators: Array.isArray(page.styleIndicators) ? page.styleIndicators : [],
              extractedSpecs: extractedSpecs ? {
                vendors: Array.isArray(extractedSpecs.vendors) ? extractedSpecs.vendors.filter((v: unknown) => typeof v === 'string') : [],
                prices: Array.isArray(extractedSpecs.prices) ? extractedSpecs.prices.filter((v: unknown) => typeof v === 'string') : [],
                dimensions: Array.isArray(extractedSpecs.dimensions) ? extractedSpecs.dimensions.filter((v: unknown) => typeof v === 'string') : [],
                skus: Array.isArray(extractedSpecs.skus) ? extractedSpecs.skus.filter((v: unknown) => typeof v === 'string') : [],
                productNames: Array.isArray(extractedSpecs.productNames) ? extractedSpecs.productNames.filter((v: unknown) => typeof v === 'string') : [],
              } : undefined,
            };
          });

        // Log extracted specs for debugging
        const pagesWithSpecs = validatedPages.filter(p =>
          p.extractedSpecs?.vendors?.length ||
          p.extractedSpecs?.prices?.length ||
          p.products.some(prod => prod.extractedVendor || prod.extractedPrice)
        ).length;
        const productsWithSpecs = validatedPages.flatMap(p => p.products).filter(
          prod => prod.extractedVendor || prod.extractedPrice || prod.extractedDimensions || prod.extractedSku
        ).length;
        console.log(`PDF analysis complete: ${validatedPages.length} pages with content, ${pagesWithSpecs} pages with specs, ${productsWithSpecs} products with extracted specs`);

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
