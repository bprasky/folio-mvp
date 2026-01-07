/**
 * AI-powered intelligent quote placement system
 * Analyzes image background to find optimal placement and text color
 */

import sharp from 'sharp';

interface QuotePlacement {
  x: number; // Center X position
  y: number; // Center Y position
  color: string; // Text color (#FFFFFF, #FFFAF5, or #1A1A1A)
  shadowColor: string; // Shadow color
  shadowOpacity: number; // Shadow opacity
  hasScrim: boolean; // Whether to add a scrim overlay
  scrimColor?: string; // Scrim color if needed
  rules?: boolean; // Whether to show horizontal rules
  rulesColor?: string; // Rules color
  glow?: boolean; // Whether to use glow effect for very dark images
}

interface BackgroundZone {
  x: number;
  y: number;
  width: number;
  height: number;
  avgLuminance: number;
  variance: number; // Lower = more consistent
  dominantColor: { r: number; g: number; b: number };
}

const INSTAGRAM_WIDTH = 1080;
const INSTAGRAM_HEIGHT = 1350;
const LOWER_REGION_START = INSTAGRAM_HEIGHT * 0.6; // Lower 40% of image

// Simple cache for background analysis (keyed by image buffer hash)
const analysisCache = new Map<string, BackgroundZone | null>();
const CACHE_SIZE_LIMIT = 50; // Limit cache size

/**
 * Calculate luminance from RGB values
 */
function calculateLuminance(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/**
 * Sample pixels from a region and analyze
 */
async function analyzeRegion(
  imageBuffer: Buffer,
  x: number,
  y: number,
  width: number,
  height: number
): Promise<BackgroundZone> {
  // Get image metadata first
  const metadata = await sharp(imageBuffer).metadata();
  const imgWidth = metadata.width || INSTAGRAM_WIDTH;
  const imgHeight = metadata.height || INSTAGRAM_HEIGHT;
  
  // Clamp coordinates to image bounds
  const clampedX = Math.max(0, Math.min(x, imgWidth - 1));
  const clampedY = Math.max(0, Math.min(y, imgHeight - 1));
  const clampedWidth = Math.min(width, imgWidth - clampedX);
  const clampedHeight = Math.min(height, imgHeight - clampedY);
  
  if (clampedWidth <= 0 || clampedHeight <= 0) {
    // Invalid region, return default
    return {
      x: clampedX,
      y: clampedY,
      width: clampedWidth,
      height: clampedHeight,
      avgLuminance: 128,
      variance: 1000,
      dominantColor: { r: 128, g: 128, b: 128 },
    };
  }

  // Extract region using Sharp
  const region = await sharp(imageBuffer)
    .extract({ left: Math.floor(clampedX), top: Math.floor(clampedY), width: Math.floor(clampedWidth), height: Math.floor(clampedHeight) })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { data, info } = region;
  const pixelCount = info.width * info.height;
  
  if (pixelCount === 0) {
    return {
      x: clampedX,
      y: clampedY,
      width: clampedWidth,
      height: clampedHeight,
      avgLuminance: 128,
      variance: 1000,
      dominantColor: { r: 128, g: 128, b: 128 },
    };
  }
  
  let totalR = 0;
  let totalG = 0;
  let totalB = 0;
  const luminances: number[] = [];

  // Sample every 10th pixel for performance (10% sample rate)
  const sampleRate = 10;
  const channels = info.channels || 3;
  let sampleCount = 0;
  
  for (let i = 0; i < data.length; i += channels * sampleRate) {
    if (i + 2 >= data.length) break;
    
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    
    totalR += r;
    totalG += g;
    totalB += b;
    
    const luminance = calculateLuminance(r, g, b);
    luminances.push(luminance);
    sampleCount++;
  }

  if (sampleCount === 0) {
    return {
      x: clampedX,
      y: clampedY,
      width: clampedWidth,
      height: clampedHeight,
      avgLuminance: 128,
      variance: 1000,
      dominantColor: { r: 128, g: 128, b: 128 },
    };
  }

  const avgR = totalR / sampleCount;
  const avgG = totalG / sampleCount;
  const avgB = totalB / sampleCount;
  const avgLuminance = calculateLuminance(avgR, avgG, avgB);

  // Calculate variance (consistency measure)
  const meanLum = luminances.reduce((a, b) => a + b, 0) / luminances.length;
  const variance = luminances.reduce((sum, lum) => sum + Math.pow(lum - meanLum, 2), 0) / luminances.length;

  return {
    x: clampedX,
    y: clampedY,
    width: clampedWidth,
    height: clampedHeight,
    avgLuminance,
    variance,
    dominantColor: { r: Math.round(avgR), g: Math.round(avgG), b: Math.round(avgB) },
  };
}

/**
 * Find the best background zone in the lower 40% of the image
 */
async function findBestBackgroundZone(imageBuffer: Buffer): Promise<BackgroundZone | null> {
  // Get actual image dimensions
  const metadata = await sharp(imageBuffer).metadata();
  const imgWidth = metadata.width || INSTAGRAM_WIDTH;
  const imgHeight = metadata.height || INSTAGRAM_HEIGHT;
  
  const lowerRegionStart = imgHeight * 0.6;
  const lowerRegionHeight = imgHeight - lowerRegionStart;
  const zoneWidth = imgWidth * 0.85; // 85% width for quote
  const zoneHeight = lowerRegionHeight * 0.4; // 40% of lower region height
  
  // Test multiple candidate zones
  const candidates: Promise<BackgroundZone>[] = [];
  
  // Center zone (preferred)
  candidates.push(
    analyzeRegion(
      imageBuffer,
      (imgWidth - zoneWidth) / 2,
      lowerRegionStart + (lowerRegionHeight - zoneHeight) / 2,
      zoneWidth,
      zoneHeight
    )
  );
  
  // Left zone
  candidates.push(
    analyzeRegion(
      imageBuffer,
      60,
      lowerRegionStart + (lowerRegionHeight - zoneHeight) / 2,
      zoneWidth * 0.7,
      zoneHeight
    )
  );
  
  // Right zone
  candidates.push(
    analyzeRegion(
      imageBuffer,
      imgWidth - 60 - zoneWidth * 0.7,
      lowerRegionStart + (lowerRegionHeight - zoneHeight) / 2,
      zoneWidth * 0.7,
      zoneHeight
    )
  );
  
  // Lower center (slightly lower)
  candidates.push(
    analyzeRegion(
      imageBuffer,
      (imgWidth - zoneWidth) / 2,
      lowerRegionStart + lowerRegionHeight * 0.6,
      zoneWidth,
      zoneHeight
    )
  );

  const zones = await Promise.all(candidates);
  
  // Score zones: prefer low variance (consistent) and medium luminance (readable)
  const scoredZones = zones.map(zone => {
    // Lower variance = better (more consistent)
    // Luminance between 50-180 = ideal (not too dark, not too bright)
    const varianceScore = 1000 / (1 + zone.variance); // Higher is better
    const luminanceScore = zone.avgLuminance > 50 && zone.avgLuminance < 180 
      ? 100 
      : Math.max(0, 100 - Math.abs(zone.avgLuminance - 115)); // Prefer ~115 luminance
    const totalScore = varianceScore * 0.6 + luminanceScore * 0.4;
    
    return { zone, score: totalScore };
  });

  // Sort by score and return best
  scoredZones.sort((a, b) => b.score - a.score);
  const best = scoredZones[0];
  
  // Only return if score is reasonable (has some consistency)
  if (best.score > 50) {
    return best.zone;
  }
  
  return null;
}

/**
 * Determine text color based on background luminance
 */
function determineTextColor(zone: BackgroundZone): {
  color: string;
  shadowColor: string;
  shadowOpacity: number;
  glow?: boolean;
} {
  const luminance = zone.avgLuminance;
  
  if (luminance < 50) {
    // Very dark background → warm off-white
    return {
      color: '#FFFAF5',
      shadowColor: 'rgba(0,0,0,0.25)',
      shadowOpacity: 0.25,
      glow: true, // Add glow for very dark images
    };
  } else if (luminance > 180) {
    // Very light background → deep charcoal
    return {
      color: '#1A1A1A',
      shadowColor: 'rgba(255,255,255,0.15)',
      shadowOpacity: 0.15,
    };
  } else {
    // Medium background → white with shadow
    return {
      color: '#FFFFFF',
      shadowColor: 'rgba(0,0,0,0.15)',
      shadowOpacity: 0.15,
    };
  }
}

/**
 * Simple hash function for cache key (first 100 bytes + size)
 */
function getCacheKey(buffer: Buffer): string {
  const prefix = buffer.slice(0, 100).toString('base64').substring(0, 50);
  return `${prefix}-${buffer.length}`;
}

/**
 * Smart quote placement with AI-powered background analysis
 */
export async function placeQuoteSmart(
  imageBuffer: Buffer,
  quoteText: string
): Promise<QuotePlacement> {
  // Check cache first
  const cacheKey = getCacheKey(imageBuffer);
  let bestZone: BackgroundZone | null | undefined = analysisCache.get(cacheKey);
  
  if (bestZone === undefined) {
    // Find best background zone
    bestZone = await findBestBackgroundZone(imageBuffer);
    
    // Cache result (with size limit)
    if (analysisCache.size >= CACHE_SIZE_LIMIT) {
      // Remove oldest entry (simple FIFO)
      const firstKey = analysisCache.keys().next().value;
      if (firstKey) analysisCache.delete(firstKey);
    }
    analysisCache.set(cacheKey, bestZone);
  }
  
  if (!bestZone) {
    // Fallback: lower-right corner with scrim
    return {
      x: INSTAGRAM_WIDTH * 0.75,
      y: INSTAGRAM_HEIGHT * 0.85,
      color: '#FFFFFF',
      shadowColor: 'rgba(0,0,0,0.35)',
      shadowOpacity: 0.35,
      hasScrim: true,
      scrimColor: 'rgba(0,0,0,0.45)',
      rules: false,
    };
  }

  // Determine text color based on zone
  const textColorInfo = determineTextColor(bestZone);
  
  // Position: center of the zone, but adjust to 78% from top (sweet spot)
  const targetY = INSTAGRAM_HEIGHT * 0.78;
  const zoneCenterX = bestZone.x + bestZone.width / 2;
  
  // Rules color: 20% opacity of text color
  const rulesColor = textColorInfo.color === '#FFFFFF' 
    ? 'rgba(255,255,255,0.2)'
    : textColorInfo.color === '#FFFAF5'
    ? 'rgba(255,250,245,0.2)'
    : 'rgba(26,26,26,0.2)';

  return {
    x: zoneCenterX,
    y: targetY,
    color: textColorInfo.color,
    shadowColor: textColorInfo.shadowColor,
    shadowOpacity: textColorInfo.shadowOpacity,
    hasScrim: false,
    rules: true,
    rulesColor,
    glow: textColorInfo.glow,
  };
}

/**
 * Format quote text for optimal display (max 3 lines, auto-scale font)
 */
export function formatQuoteText(quote: string, maxWidth: number = INSTAGRAM_WIDTH * 0.85): {
  lines: string[];
  fontSize: number;
} {
  const words = quote.split(' ');
  const minFontSize = 58;
  const maxFontSize = 68;
  let fontSize = maxFontSize;
  let lines: string[] = [];
  
  // Try to fit in 3 lines with max font size (retry with smaller font if needed)
  let attempts = 0;
  const maxAttempts = 5;
  
  while (attempts < maxAttempts) {
    lines = [];
    let currentLine = '';
    
    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      // Rough estimate: ~0.6 * fontSize per character for serif italic
      const estimatedWidth = testLine.length * fontSize * 0.6;
      
      if (estimatedWidth > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
        
        if (lines.length >= 3) {
          break; // Stop if we hit 3 lines
        }
      } else {
        currentLine = testLine;
      }
    }
    
    if (currentLine) {
      lines.push(currentLine);
    }
    
    // If too many lines, reduce font size and retry
    if (lines.length > 3 && fontSize > minFontSize) {
      fontSize = Math.max(minFontSize, fontSize - 4);
      attempts++;
      continue;
    }
    
    break; // Success or at minimum font size
  }
  
  // If still too many lines, truncate last line
  if (lines.length > 3) {
    lines = lines.slice(0, 2);
    const lastLine = lines[1];
    if (lastLine && lastLine.length > 30) {
      lines[1] = lastLine.substring(0, 27) + '…';
    }
  }
  
  return { lines, fontSize };
}

