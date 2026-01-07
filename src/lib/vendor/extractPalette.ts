import { ColorPalette } from '@/types/vendor-product';

/**
 * Extract color palette from an image
 * Uses canvas to sample pixels and find dominant colors
 */
export async function extractPalette(imageUrl: string): Promise<ColorPalette> {
  try {
    // Create image element
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    
    // Load image
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = imageUrl;
    });

    // Create canvas and draw image
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      throw new Error('Could not get canvas context');
    }

    // Sample at lower resolution for performance
    const maxSize = 100;
    const scale = Math.min(maxSize / img.width, maxSize / img.height);
    canvas.width = img.width * scale;
    canvas.height = img.height * scale;
    
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    
    // Extract image data
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const colors = extractDominantColors(imageData.data);
    
    return {
      primary: colors[0] || '#000000',
      secondary: colors[1] || '#ffffff',
      accent: colors[2] || '#999999',
      all: colors,
    };
  } catch (error) {
    console.error('Palette extraction failed:', error);
    
    // Return default palette on error
    return {
      primary: '#000000',
      secondary: '#ffffff',
      accent: '#999999',
      all: ['#000000', '#ffffff', '#999999'],
    };
  }
}

/**
 * Extract dominant colors from image data
 */
function extractDominantColors(data: Uint8ClampedArray): string[] {
  const colorMap: Map<string, number> = new Map();
  
  // Sample pixels (every 4th pixel for performance)
  for (let i = 0; i < data.length; i += 16) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    
    // Skip transparent pixels
    if (a < 128) continue;
    
    // Skip very light (white) and very dark (black) pixels
    if ((r > 240 && g > 240 && b > 240) || (r < 15 && g < 15 && b < 15)) {
      continue;
    }
    
    // Quantize colors to reduce similar shades
    const qr = Math.round(r / 32) * 32;
    const qg = Math.round(g / 32) * 32;
    const qb = Math.round(b / 32) * 32;
    
    const hex = rgbToHex(qr, qg, qb);
    colorMap.set(hex, (colorMap.get(hex) || 0) + 1);
  }
  
  // Sort by frequency and return top 5
  return Array.from(colorMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([color]) => color);
}

/**
 * Convert RGB values to hex color string
 */
function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b]
    .map(x => Math.max(0, Math.min(255, x)).toString(16).padStart(2, '0'))
    .join('')}`;
}

/**
 * Get readable color name for display
 */
export function getColorName(hex: string): string {
  const colors: Record<string, string> = {
    '#000000': 'Black',
    '#ffffff': 'White',
    '#ff0000': 'Red',
    '#00ff00': 'Green',
    '#0000ff': 'Blue',
    '#ffff00': 'Yellow',
    '#ff00ff': 'Magenta',
    '#00ffff': 'Cyan',
  };
  
  return colors[hex.toLowerCase()] || hex;
}




