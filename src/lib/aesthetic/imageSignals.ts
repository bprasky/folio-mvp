import sharp from 'sharp';
import { ImageSignals, ColorTemperature, ContrastLevel } from './types';

/**
 * Analyze image using Sharp to extract color signals
 * This is a fallback when Claude Vision is unavailable
 */
export async function analyzeImage(url: string): Promise<ImageSignals> {
  try {
    const response = await fetch(url);
    const buffer = await response.arrayBuffer();
    
    const image = sharp(Buffer.from(buffer));
    const stats = await image.stats();
    const metadata = await image.metadata();
    
    // Resize to small sample for color extraction
    const { data, info } = await image
      .resize(50, 50, { fit: 'cover' })
      .raw()
      .toBuffer({ resolveWithObject: true });
    
    // Extract dominant colors from pixel data
    const dominantColors = extractDominantColorsFromPixels(data, info);
    
    // Get dominant color from stats (average of all channels)
    const dominant = stats.channels[0]?.mean || { r: 128, g: 128, b: 128 };
    const dominantRgb = {
      r: Math.round(dominant.r || 128),
      g: Math.round(dominant.g || 128),
      b: Math.round(dominant.b || 128),
    };
    
    // Calculate color temperature from dominant color
    const colorTemperature = calculateColorTemperature(dominantRgb);
    
    // Calculate average lightness
    const lightnessAvg = (dominantRgb.r + dominantRgb.g + dominantRgb.b) / 3 / 255;
    
    return {
      dominantColors,
      colorTemperature,
      saturation: calculateSaturation(dominantRgb),
      contrast: 'medium',
      whitespaceRatio: lightnessAvg > 0.8 ? 0.5 : 0.2,
      textureComplexity: 0.5,
      lightnessAvg,
    };
  } catch (error) {
    console.error('Image analysis failed:', error);
    return {
      dominantColors: [],
      colorTemperature: 'neutral',
      saturation: 0.5,
      contrast: 'medium',
      whitespaceRatio: 0.3,
      textureComplexity: 0.5,
      lightnessAvg: 0.7,
    };
  }
}

function extractDominantColorsFromPixels(data: Buffer, info: { width: number; height: number; channels: number }): string[] {
  const colorCounts = new Map<string, number>();
  const step = 3; // Sample every 3rd pixel for performance
  
  for (let i = 0; i < data.length; i += info.channels * step) {
    if (i + 2 >= data.length) break;
    
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    
    // Quantize to reduce unique colors (round to nearest 32)
    const qr = Math.round(r / 32) * 32;
    const qg = Math.round(g / 32) * 32;
    const qb = Math.round(b / 32) * 32;
    
    const hex = rgbToHex(qr, qg, qb);
    colorCounts.set(hex, (colorCounts.get(hex) || 0) + 1);
  }
  
  // Sort by frequency and return top 8
  return Array.from(colorCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([hex]) => hex);
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(x => {
    const hex = Math.min(255, Math.max(0, x)).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
}

function calculateColorTemperature(dominant: { r: number; g: number; b: number }): ColorTemperature {
  const warmth = (dominant.r * 1.0 + dominant.g * 0.5) - (dominant.b * 1.0);
  if (warmth > 50) return 'warm';
  if (warmth < -50) return 'cool';
  return 'neutral';
}

function calculateSaturation(dominant: { r: number; g: number; b: number }): number {
  const max = Math.max(dominant.r, dominant.g, dominant.b);
  const min = Math.min(dominant.r, dominant.g, dominant.b);
  if (max === 0) return 0;
  return (max - min) / max;
}

/**
 * Extract color temperature from hex colors
 */
export function inferColorTemperature(colors: string[]): ColorTemperature {
  if (colors.length === 0) return 'neutral';
  
  let warmCount = 0;
  let coolCount = 0;
  
  for (const hex of colors) {
    const rgb = hexToRgb(hex);
    if (!rgb) continue;
    
    // Warm colors: red, orange, yellow tones
    // Cool colors: blue, green, purple tones
    if (rgb.r > rgb.b && rgb.r > rgb.g * 0.8) {
      warmCount++;
    } else if (rgb.b > rgb.r && rgb.b > rgb.g * 0.8) {
      coolCount++;
    }
  }
  
  if (warmCount > coolCount * 1.5) return 'warm';
  if (coolCount > warmCount * 1.5) return 'cool';
  return 'neutral';
}

/**
 * Infer contrast level from saturation and lightness
 */
export function inferContrast(saturation: number, lightnessAvg: number): ContrastLevel {
  const contrastScore = Math.abs(lightnessAvg - 0.5) * 2 + saturation;
  
  if (contrastScore > 0.7) return 'high';
  if (contrastScore < 0.3) return 'low';
  return 'medium';
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16) / 255,
        g: parseInt(result[2], 16) / 255,
        b: parseInt(result[3], 16) / 255,
      }
    : null;
}


