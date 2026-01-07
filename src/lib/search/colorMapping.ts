const COLOR_MAP: Record<string, { r: number; g: number; b: number }> = {
  // Neutrals
  white: { r: 255, g: 255, b: 255 },
  black: { r: 0, g: 0, b: 0 },
  gray: { r: 128, g: 128, b: 128 },
  beige: { r: 245, g: 245, b: 220 },
  cream: { r: 255, g: 253, b: 208 },
  ivory: { r: 255, g: 255, b: 240 },
  charcoal: { r: 54, g: 69, b: 79 },
  
  // Browns/Woods
  brown: { r: 139, g: 90, b: 43 },
  tan: { r: 210, g: 180, b: 140 },
  oak: { r: 180, g: 140, b: 100 },
  walnut: { r: 90, g: 60, b: 40 },
  
  // Metals
  brass: { r: 181, g: 166, b: 66 },
  gold: { r: 255, g: 215, b: 0 },
  silver: { r: 192, g: 192, b: 192 },
  chrome: { r: 220, g: 220, b: 220 },
  copper: { r: 184, g: 115, b: 51 },
  
  // Colors
  blue: { r: 0, g: 100, b: 180 },
  navy: { r: 0, g: 0, b: 128 },
  green: { r: 34, g: 139, b: 34 },
  sage: { r: 143, g: 176, b: 143 },
  red: { r: 180, g: 30, b: 30 },
  terracotta: { r: 204, g: 102, b: 51 },
  pink: { r: 255, g: 182, b: 193 },
  blush: { r: 222, g: 184, b: 184 },
  yellow: { r: 255, g: 223, b: 0 },
  orange: { r: 255, g: 140, b: 0 },
  purple: { r: 128, g: 0, b: 128 },
  teal: { r: 0, g: 128, b: 128 },
};

function colorDistance(c1: { r: number; g: number; b: number }, c2: { r: number; g: number; b: number }): number {
  return Math.sqrt(
    Math.pow(c1.r - c2.r, 2) +
    Math.pow(c1.g - c2.g, 2) +
    Math.pow(c1.b - c2.b, 2)
  );
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  } : null;
}

export function hexToColorName(hex: string): string | null {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  
  const lightness = (rgb.r + rgb.g + rgb.b) / 3 / 255;
  const max = Math.max(rgb.r, rgb.g, rgb.b);
  const min = Math.min(rgb.r, rgb.g, rgb.b);
  const saturation = max === 0 ? 0 : (max - min) / max;
  
  // Handle near-neutral colors
  if (saturation < 0.15) {
    if (lightness > 0.85) return 'white';
    if (lightness < 0.15) return 'black';
    if (lightness > 0.6) return 'cream';
    return 'gray';
  }
  
  let closestColor: string | null = null;
  let closestDistance = Infinity;
  
  for (const [name, color] of Object.entries(COLOR_MAP)) {
    const distance = colorDistance(rgb, color);
    if (distance < closestDistance) {
      closestDistance = distance;
      closestColor = name;
    }
  }
  
  return closestDistance < 120 ? closestColor : null;
}

export function hexArrayToColorNames(hexColors: string[]): string[] {
  const names = hexColors
    .map(hex => hexToColorName(hex))
    .filter((name): name is string => name !== null);
  
  const unique = [...new Set(names)];
  const neutrals = ['white', 'black', 'gray', 'beige', 'cream', 'ivory'];
  const interestingColors = unique.filter(c => !neutrals.includes(c));
  
  if (interestingColors.length > 0) {
    const keptNeutrals = unique.filter(c => neutrals.includes(c)).slice(0, 1);
    return [...interestingColors, ...keptNeutrals];
  }
  
  return unique.slice(0, 3);
}

