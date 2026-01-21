/**
 * Pattern Recognition Module
 * Identifies product specification patterns in extracted text
 */

export const SPEC_PATTERNS = {
  // Brand - Product Name (common format)
  // e.g., "FOURHANDS - ELLE SIDEBOARD", "APPARATUS - Median Pendant"
  brandProduct: /^([A-Z][A-Z0-9\s&'.]+?)\s*[-–—]\s*(.+)$/,

  // Price patterns
  // e.g., "$1,485", "$6,120 ea.", "$5,950.00"
  price: /\$\s*([\d,]+(?:\.\d{2})?)\s*(?:ea\.?|each)?/i,

  // Dimension patterns
  // e.g., "92"W × 19"D × 26"H", "118"L X 47.25"D X 30"H", "19.29" Diam"
  dimensionsLWH: /(\d+(?:\.\d+)?)"?\s*[LWDH]\s*[×xX]\s*(\d+(?:\.\d+)?)"?\s*[LWDH](?:\s*[×xX]\s*(\d+(?:\.\d+)?)"?\s*[LWDH])?/i,
  dimensionsDiam: /(\d+(?:\.\d+)?)"?\s*Diam(?:eter)?/i,
  dimensionsSimple: /(\d+(?:\.\d+)?)\s*["'']\s*[WwLl]\s*[×xX]\s*(\d+(?:\.\d+)?)\s*["'']\s*[DdWw]\s*[×xX]\s*(\d+(?:\.\d+)?)\s*["'']\s*[Hh]/,
  dimensionsInches: /(\d+(?:\.\d+)?)\s*[×xX]\s*(\d+(?:\.\d+)?)\s*[×xX]\s*(\d+(?:\.\d+)?)\s*(?:in(?:ches)?)?/i,

  // Material/finish descriptions
  // e.g., "Natural fossil stone - Sealed and polished", "Ashwood - Natural"
  materialFinish: /^([A-Za-z\s]+)\s*[-–]\s*([A-Za-z\s]+)$/,

  // SKU patterns
  // e.g., "SKU: 12345", "Item #: ABC-123", "Model: XYZ789"
  sku: /(?:SKU|Item\s*#?|Model|Style|Part\s*#?|Product\s*#?)[:\s]+([A-Z0-9\-_.]+)/i,

  // URL patterns
  url: /https?:\/\/[^\s<>"{}|\\^`[\]]+/i,

  // Quantity patterns
  // e.g., "Qty: 2", "Quantity: 4"
  quantity: /(?:Qty|Quantity)[:\s]*(\d+)/i,

  // Known vendor names (expand this list)
  knownVendors: [
    'APPARATUS', 'FOURHANDS', 'FOUR HANDS', 'SERENA & LILY', 'SERENA AND LILY',
    'RESTORATION HARDWARE', 'RH', 'HOLLY HUNT', 'SONIAH', 'PERENNIALS',
    'FOROM SHOP', 'ARTERIORS', 'VISUAL COMFORT', 'CIRCA LIGHTING',
    'KRAVET', 'SCHUMACHER', 'LEE JOFA', 'BRUNSCHWIG', 'RALPH LAUREN HOME',
    'BAKER', 'MCGUIRE', 'HICKORY CHAIR', 'CENTURY', 'MAITLAND SMITH',
    'BRADLEY', 'CURREY', 'CURREY & COMPANY', 'GABBY', 'GABBY HOME',
    'NOIR', 'NOIR FURNITURE', 'UTTERMOST', 'HOOKER', 'BERNHARDT',
    'CARACOLE', 'LEXINGTON', 'TOMMY BAHAMA', 'UNIVERSAL', 'STANLEY',
    'THEODORE ALEXANDER', 'LILLIAN AUGUST', 'AERIN', 'KELLY WEARSTLER',
    'PORTA ROMANA', 'OCHRE', 'ROLL & HILL', 'FLOS', 'LOUIS POULSEN',
    'SONNEMAN', 'TECH LIGHTING', 'HINKLEY', 'TROY', 'HUDSON VALLEY',
    'MITZI', 'CORBETT', 'FINE ART LAMPS', 'KALCO', 'MINKA',
    'SAFAVIEH', 'SURYA', 'DASH AND ALBERT', 'DASH & ALBERT', 'ANNIE SELKE',
    'STARK', 'PATTERSON FLYNN', 'LANDRY & ARCARI', 'TUFENKIAN',
    'PHILLIP JEFFRIES', 'SCALAMANDR', 'THIBAUT', 'YORK', 'BREWSTER',
    'COLE & SON', 'FARROW & BALL', 'BENJAMIN MOORE', 'SHERWIN WILLIAMS',
    'KOHLER', 'WATERWORKS', 'KALLISTA', 'BRIZO', 'ROHL', 'NEWPORT BRASS',
    'ANN SACKS', 'WALKER ZANGER', 'ARTISTIC TILE', 'WATERWORKS',
    'MITCHELL GOLD', 'BOB WILLIAMS', 'MITCHELL GOLD + BOB WILLIAMS',
    'POTTERY BARN', 'WEST ELM', 'CB2', 'CRATE AND BARREL', 'CRATE & BARREL',
    'ROOM & BOARD', 'DESIGN WITHIN REACH', 'DWR', 'KNOLL', 'HERMAN MILLER',
    'HAWORTH', 'STEELCASE', 'VITRA', 'KARTELL', 'ALESSI',
    'ROVE CONCEPTS', 'ARTICLE', 'JOYBIRD', 'BURROW', 'FLOYD',
    'THUMA', 'BROOKLINEN', 'PARACHUTE', 'BOLL & BRANCH'
  ]
}

export interface ParsedDimensions {
  width: number | null
  depth: number | null
  height: number | null
  length: number | null
  diameter: number | null
  unit: 'inches' | 'cm'
}

export interface ParsedSpecification {
  brand: string | null
  productName: string | null
  price: number | null
  currency: 'USD' | 'EUR' | 'GBP'
  dimensions: ParsedDimensions | null
  material: string | null
  finish: string | null
  sku: string | null
  quantity: number | null
  productUrl: string | null
  rawText: string[]
}

/**
 * Parses a price string and returns the value in cents
 */
export function parsePrice(priceStr: string): number | null {
  const match = priceStr.match(SPEC_PATTERNS.price)
  if (!match) return null

  const numStr = match[1].replace(/,/g, '')
  const value = parseFloat(numStr)

  if (isNaN(value)) return null

  // Convert to cents
  return Math.round(value * 100)
}

/**
 * Parses dimension strings and returns structured dimensions
 */
export function parseDimensions(text: string): ParsedDimensions | null {
  // Try diameter first
  const diamMatch = text.match(SPEC_PATTERNS.dimensionsDiam)
  if (diamMatch) {
    return {
      width: null,
      depth: null,
      height: null,
      length: null,
      diameter: parseFloat(diamMatch[1]),
      unit: 'inches'
    }
  }

  // Try LWH format
  const lwhMatch = text.match(SPEC_PATTERNS.dimensionsLWH)
  if (lwhMatch) {
    const dim1 = parseFloat(lwhMatch[1])
    const dim2 = parseFloat(lwhMatch[2])
    const dim3 = lwhMatch[3] ? parseFloat(lwhMatch[3]) : null

    // Determine which dimension is which based on the letter
    const textUpper = text.toUpperCase()
    const firstDimIndex = textUpper.search(/\d+(?:\.\d+)?["']?\s*[LWDH]/i)
    const firstDimLetter = textUpper.substring(firstDimIndex).match(/[LWDH]/)?.[0]

    if (firstDimLetter === 'L') {
      return {
        length: dim1,
        width: dim2,
        depth: dim2,
        height: dim3,
        diameter: null,
        unit: 'inches'
      }
    } else if (firstDimLetter === 'W') {
      return {
        width: dim1,
        depth: dim2,
        height: dim3,
        length: null,
        diameter: null,
        unit: 'inches'
      }
    }

    // Default interpretation
    return {
      width: dim1,
      depth: dim2,
      height: dim3,
      length: null,
      diameter: null,
      unit: 'inches'
    }
  }

  // Try simple dimensions format
  const simpleMatch = text.match(SPEC_PATTERNS.dimensionsSimple)
  if (simpleMatch) {
    return {
      width: parseFloat(simpleMatch[1]),
      depth: parseFloat(simpleMatch[2]),
      height: parseFloat(simpleMatch[3]),
      length: null,
      diameter: null,
      unit: 'inches'
    }
  }

  // Try generic X x X x X format
  const inchesMatch = text.match(SPEC_PATTERNS.dimensionsInches)
  if (inchesMatch) {
    return {
      width: parseFloat(inchesMatch[1]),
      depth: parseFloat(inchesMatch[2]),
      height: parseFloat(inchesMatch[3]),
      length: null,
      diameter: null,
      unit: 'inches'
    }
  }

  return null
}

/**
 * Extracts brand name from text, checking against known vendors
 */
export function extractBrand(text: string): string | null {
  const textUpper = text.toUpperCase()

  // Check against known vendors
  for (const vendor of SPEC_PATTERNS.knownVendors) {
    if (textUpper.includes(vendor)) {
      // Return the properly cased version
      return vendor
        .split(' ')
        .map(word => word.charAt(0) + word.slice(1).toLowerCase())
        .join(' ')
    }
  }

  // Try brand - product pattern
  const match = text.match(SPEC_PATTERNS.brandProduct)
  if (match) {
    return match[1].trim()
  }

  return null
}

/**
 * Extracts product name from text
 */
export function extractProductName(text: string, brand: string | null): string | null {
  // Try brand - product pattern
  const match = text.match(SPEC_PATTERNS.brandProduct)
  if (match) {
    return match[2].trim()
  }

  // If we have a brand, try to find text after it
  if (brand) {
    const brandIndex = text.toUpperCase().indexOf(brand.toUpperCase())
    if (brandIndex >= 0) {
      const afterBrand = text.substring(brandIndex + brand.length).trim()
      // Remove leading separators
      const cleaned = afterBrand.replace(/^[-–—:\s]+/, '').trim()
      if (cleaned) {
        return cleaned.split('\n')[0].trim()
      }
    }
  }

  return null
}

/**
 * Extracts SKU from text
 */
export function extractSKU(text: string): string | null {
  const match = text.match(SPEC_PATTERNS.sku)
  return match ? match[1].trim() : null
}

/**
 * Extracts URL from text
 */
export function extractURL(text: string): string | null {
  const match = text.match(SPEC_PATTERNS.url)
  return match ? match[0] : null
}

/**
 * Extracts quantity from text
 */
export function extractQuantity(text: string): number | null {
  const match = text.match(SPEC_PATTERNS.quantity)
  if (match) {
    const qty = parseInt(match[1], 10)
    return isNaN(qty) ? null : qty
  }
  return null
}

/**
 * Parses a cluster of text blocks into a structured specification
 */
export function parseTextCluster(texts: string[]): ParsedSpecification {
  const combinedText = texts.join(' ')
  const allText = texts.join('\n')

  // Initialize result
  const result: ParsedSpecification = {
    brand: null,
    productName: null,
    price: null,
    currency: 'USD',
    dimensions: null,
    material: null,
    finish: null,
    sku: null,
    quantity: null,
    productUrl: null,
    rawText: texts
  }

  // Extract each field
  result.brand = extractBrand(combinedText)
  result.productName = extractProductName(combinedText, result.brand)

  // Extract price
  const priceMatch = combinedText.match(SPEC_PATTERNS.price)
  if (priceMatch) {
    result.price = parsePrice(priceMatch[0])
  }

  // Extract dimensions
  result.dimensions = parseDimensions(combinedText)

  // Extract SKU
  result.sku = extractSKU(combinedText)

  // Extract URL
  result.productUrl = extractURL(combinedText)

  // Extract quantity
  result.quantity = extractQuantity(combinedText)

  // Try to extract material/finish from individual lines
  for (const line of texts) {
    const materialMatch = line.match(SPEC_PATTERNS.materialFinish)
    if (materialMatch) {
      if (!result.material) {
        result.material = materialMatch[1].trim()
      }
      if (!result.finish) {
        result.finish = materialMatch[2].trim()
      }
    }
  }

  // If no product name but we have some descriptive text, use the first substantial line
  if (!result.productName && texts.length > 0) {
    const substantialLine = texts.find(t => t.length > 10 && !t.match(SPEC_PATTERNS.price))
    if (substantialLine) {
      result.productName = substantialLine.trim().substring(0, 100)
    }
  }

  return result
}
