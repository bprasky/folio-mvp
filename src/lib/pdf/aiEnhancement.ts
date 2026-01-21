/**
 * AI Enhancement Module
 * Uses Claude to complete missing specification fields and generate search queries
 */

import Anthropic from '@anthropic-ai/sdk'
import {
  ExtractedItem,
  identifyMissingFields,
  calculateCompleteness,
  generateSearchQuery
} from './confidence'
import type { ParsedDimensions } from './patterns'

const anthropic = new Anthropic()

interface AISpecificationResult {
  found: boolean
  confidence: 'high' | 'medium' | 'low'
  productName: string | null
  brand: string | null
  sku: string | null
  price: number | null  // in cents, USD
  dimensions: ParsedDimensions | null
  material: string | null
  finish: string | null
  productUrl: string | null
  source: string
}

/**
 * For SPECIFICATIONS: Complete missing fields using AI
 */
export async function completeSpecificationWithAI(
  item: ExtractedItem
): Promise<ExtractedItem> {
  if (item.missingFields.length === 0) {
    return item
  }

  const searchQuery = generateSearchQuery(item)

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: `You are a product research assistant for interior design specifications.
Given partial product information, provide the most likely complete specification based on your knowledge.

Return ONLY valid JSON matching this schema:
{
  "found": boolean,
  "confidence": "high" | "medium" | "low",
  "productName": string | null,
  "brand": string | null,
  "sku": string | null,
  "price": number | null,
  "dimensions": {
    "width": number | null,
    "depth": number | null,
    "height": number | null,
    "unit": "inches" | "cm"
  } | null,
  "material": string | null,
  "finish": string | null,
  "productUrl": string | null,
  "source": string
}

Price should be in cents (e.g., $1,485.00 = 148500).

If you cannot find reliable information, set "found": false.
Do not guess or fabricate data - only return information you are confident about.
For URLs, only return if you know the actual product page URL.`,
      messages: [{
        role: 'user',
        content: `Complete the specification for this product:

Known information:
- Brand: ${item.brand || 'Unknown'}
- Product Name: ${item.productName || 'Unknown'}
- Price: ${item.price ? `$${(item.price / 100).toFixed(2)}` : 'Unknown'}
- Dimensions: ${item.dimensions ? JSON.stringify(item.dimensions) : 'Unknown'}
- Material: ${item.material || 'Unknown'}
- SKU: ${item.sku || 'Unknown'}

Missing fields needed: ${item.missingFields.join(', ')}

Search query to use: "${searchQuery}"

Source text from PDF:
${item.sourceText.join('\n')}`
      }]
    })

    const content = response.content[0]
    if (content.type === 'text') {
      // Extract JSON from the response (handle potential markdown code blocks)
      let jsonText = content.text.trim()
      if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/```json?\n?/g, '').replace(/```$/g, '').trim()
      }

      const result: AISpecificationResult = JSON.parse(jsonText)

      if (result.found) {
        return mergeSpecificationData(item, result)
      }
    }
  } catch (e) {
    console.error('Failed to complete specification with AI:', e)
  }

  return item
}

/**
 * For INSPIRATION: Generate a descriptive search query from an image
 */
export async function generateInspirationSearchQuery(
  imageBase64: string
): Promise<string> {
  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 256,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: 'image/png',
              data: imageBase64
            }
          },
          {
            type: 'text',
            text: `Describe this interior design element for a product search.
Be specific about:
- Material (wood, metal, stone, fabric, etc.)
- Style (modern, traditional, organic, industrial, etc.)
- Color/finish
- Form/shape
- Function (if identifiable)

Return ONLY a concise search query, 5-15 words.
Example: "Natural woven rattan pendant light with brass hardware"
Example: "Cream boucle upholstered accent chair with oak legs"
Example: "Honed marble waterfall edge coffee table organic shape"`
          }
        ]
      }]
    })

    const content = response.content[0]
    if (content.type === 'text') {
      return content.text.trim()
    }
  } catch (e) {
    console.error('Failed to generate inspiration search query:', e)
  }

  return 'Design element'
}

/**
 * Analyze a page image to identify products and their locations
 */
export async function analyzePageImage(
  imageBase64: string,
  existingItems: ExtractedItem[]
): Promise<{
  products: Array<{
    description: string
    category: string
    estimatedBounds: { x: number; y: number; width: number; height: number }
  }>
}> {
  try {
    const existingContext = existingItems.length > 0
      ? `Already identified: ${existingItems.map(i => i.productName || i.brand).filter(Boolean).join(', ')}`
      : ''

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: 'image/png',
              data: imageBase64
            }
          },
          {
            type: 'text',
            text: `Analyze this interior design presentation page and identify distinct products/furniture.

${existingContext}

For each product you identify, provide:
1. A brief description
2. Category (FURNITURE, LIGHTING, TEXTILES, ACCESSORIES, SURFACES, PLUMBING, OTHER)
3. Estimated position on the page (x, y as percentages 0-100, width/height as percentages)

Return JSON:
{
  "products": [
    {
      "description": "Navy velvet sofa with brass legs",
      "category": "FURNITURE",
      "estimatedBounds": { "x": 10, "y": 20, "width": 40, "height": 30 }
    }
  ]
}

Only include products you can clearly identify. Do not guess at items that are unclear.`
          }
        ]
      }]
    })

    const content = response.content[0]
    if (content.type === 'text') {
      let jsonText = content.text.trim()
      if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/```json?\n?/g, '').replace(/```$/g, '').trim()
      }

      return JSON.parse(jsonText)
    }
  } catch (e) {
    console.error('Failed to analyze page image:', e)
  }

  return { products: [] }
}

/**
 * Merge AI results with existing item data
 */
function mergeSpecificationData(
  original: ExtractedItem,
  aiResult: AISpecificationResult
): ExtractedItem {
  const merged: ExtractedItem = {
    ...original,
    productName: original.productName || aiResult.productName,
    brand: original.brand || aiResult.brand,
    sku: original.sku || aiResult.sku,
    price: original.price || aiResult.price,
    dimensions: original.dimensions || aiResult.dimensions,
    material: original.material || aiResult.material,
    finish: original.finish || aiResult.finish,
    productUrl: original.productUrl || aiResult.productUrl
  }

  // Recalculate computed fields
  merged.missingFields = identifyMissingFields(merged)
  merged.completenessScore = calculateCompleteness(merged)
  merged.searchQuery = generateSearchQuery(merged)

  return merged
}

/**
 * Batch process multiple items with AI enhancement
 */
export async function enhanceItemsWithAI(
  items: ExtractedItem[],
  options: {
    enhanceSpecifications?: boolean
    generateSearchQueries?: boolean
    maxConcurrent?: number
  } = {}
): Promise<ExtractedItem[]> {
  const opts = {
    enhanceSpecifications: true,
    generateSearchQueries: true,
    maxConcurrent: 3,
    ...options
  }

  const results: ExtractedItem[] = []

  // Process in batches to avoid rate limits
  for (let i = 0; i < items.length; i += opts.maxConcurrent) {
    const batch = items.slice(i, i + opts.maxConcurrent)

    const batchResults = await Promise.all(
      batch.map(async (item) => {
        let enhanced = item

        // Enhance specifications with missing fields
        if (opts.enhanceSpecifications &&
            item.type === 'specification' &&
            item.missingFields.length > 0) {
          enhanced = await completeSpecificationWithAI(item)
        }

        // Generate search query for inspiration items
        if (opts.generateSearchQueries &&
            item.type === 'inspiration' &&
            item.imageData &&
            !item.searchQuery) {
          const query = await generateInspirationSearchQuery(item.imageData)
          enhanced = {
            ...enhanced,
            searchQuery: query,
            description: query
          }
        }

        return enhanced
      })
    )

    results.push(...batchResults)
  }

  return results
}
