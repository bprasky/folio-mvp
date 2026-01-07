import {
  AestheticProfile,
  AestheticTheme,
  DetectionInput,
  ImageSignals,
  MaterialSignals,
  SpatialSignals,
  LanguageSignals,
  ColorTemperature,
  ContrastLevel,
  DensityLevel,
  BrandAssets,
} from './types';
import { analyzeImage } from './imageSignals';
import { extractMaterialSignals } from './materialSignals';
import { extractSpatialSignals } from './spatialSignals';
import { extractLanguageSignals } from './languageSignals';

/**
 * Score themes based on image signals
 */
function scoreFromImageSignals(
  imageSignals: ImageSignals[],
  scores: Record<AestheticTheme, number>
): void {
  if (imageSignals.length === 0) return;
  
  // Aggregate signals across all images
  const avgWhitespace = imageSignals.reduce((sum, s) => sum + s.whitespaceRatio, 0) / imageSignals.length;
  const avgSaturation = imageSignals.reduce((sum, s) => sum + s.saturation, 0) / imageSignals.length;
  const avgLightness = imageSignals.reduce((sum, s) => sum + s.lightnessAvg, 0) / imageSignals.length;
  
  const tempCounts: Record<ColorTemperature, number> = { cool: 0, neutral: 0, warm: 0 };
  const contrastCounts: Record<ContrastLevel, number> = { low: 0, medium: 0, high: 0 };
  
  for (const sig of imageSignals) {
    tempCounts[sig.colorTemperature]++;
    contrastCounts[sig.contrast]++;
  }
  
  const dominantTemp = Object.entries(tempCounts).sort((a, b) => b[1] - a[1])[0]?.[0] as ColorTemperature;
  const dominantContrast = Object.entries(contrastCounts).sort((a, b) => b[1] - a[1])[0]?.[0] as ContrastLevel;
  
  // High whitespace + low saturation + neutral temp → minimal
  if (avgWhitespace > 0.4 && avgSaturation < 0.4 && dominantTemp === 'neutral') {
    scores.minimal += 30;
  }
  
  // High contrast → editorial, bold, moody
  if (dominantContrast === 'high') {
    scores.editorial += 20;
    scores.bold += 15;
    scores.moody += 10;
  }
  
  // Warm temperature → warm, coastal
  if (dominantTemp === 'warm') {
    scores.warm += 25;
    scores.coastal += 10;
  }
  
  // Cool temperature → moody, minimal
  if (dominantTemp === 'cool') {
    scores.moody += 15;
    scores.minimal += 10;
  }
  
  // Low saturation → minimal, moody
  if (avgSaturation < 0.3) {
    scores.minimal += 15;
    scores.moody += 10;
  }
}

/**
 * Score themes based on material signals
 */
function scoreFromMaterialSignals(
  materialSignals: MaterialSignals,
  scores: Record<AestheticTheme, number>
): void {
  const total = materialSignals.naturalMaterials + 
                materialSignals.metalMaterials + 
                materialSignals.syntheticMaterials;
  
  if (total === 0) return;
  
  const naturalRatio = materialSignals.naturalMaterials / total;
  const metalRatio = materialSignals.metalMaterials / total;
  
  // Natural materials > 60% → warm
  if (naturalRatio > 0.6) {
    scores.warm += 30;
    scores.coastal += 15;
  }
  
  // High metal ratio → bold, editorial
  if (metalRatio > 0.4) {
    scores.bold += 20;
    scores.editorial += 15;
  }
  
  // Mixed materials → eclectic
  if (naturalRatio > 0.3 && metalRatio > 0.2 && materialSignals.syntheticMaterials / total > 0.2) {
    scores.eclectic += 25;
  }
}

/**
 * Score themes based on spatial signals
 */
function scoreFromSpatialSignals(
  spatialSignals: SpatialSignals,
  scores: Record<AestheticTheme, number>
): void {
  // Low object density < 4 → minimal
  if (spatialSignals.avgObjectDensity < 4) {
    scores.minimal += 25;
  }
  
  // High object density > 10 → eclectic
  if (spatialSignals.avgObjectDensity > 10) {
    scores.eclectic += 20;
  }
  
  // Architectural emphasis → editorial, minimal
  if (spatialSignals.architecturalEmphasis) {
    scores.editorial += 20;
    scores.minimal += 15;
  }
  
  // High symmetry → minimal, editorial
  if (spatialSignals.symmetryScore > 0.6) {
    scores.minimal += 15;
    scores.editorial += 10;
  }
}

/**
 * Score themes based on language signals
 */
function scoreFromLanguageSignals(
  languageSignals: LanguageSignals,
  scores: Record<AestheticTheme, number>
): void {
  // Restrained emotional tone → minimal
  if (languageSignals.emotionalTone === 'restrained') {
    scores.minimal += 25;
  }
  
  // Warm emotional tone → warm, coastal
  if (languageSignals.emotionalTone === 'warm') {
    scores.warm += 20;
    scores.coastal += 10;
  }
  
  // Dramatic emotional tone → bold, moody
  if (languageSignals.emotionalTone === 'dramatic') {
    scores.bold += 20;
    scores.moody += 15;
  }
  
  // Playful emotional tone → eclectic, bold
  if (languageSignals.emotionalTone === 'playful') {
    scores.eclectic += 15;
    scores.bold += 10;
  }
  
  // Technical vocabulary → editorial
  if (languageSignals.vocabularyStyle === 'technical') {
    scores.editorial += 15;
  }
  
  // Poetic vocabulary → warm, moody
  if (languageSignals.vocabularyStyle === 'poetic') {
    scores.warm += 10;
    scores.moody += 10;
  }
}

/**
 * Score themes based on brand assets
 */
function scoreFromBrandAssets(brand: BrandAssets, scores: Record<AestheticTheme, number>): void {
  // Brand adjectives are strong signals (designer self-identified)
  const adjectives = brand.brandAdjectives.map((a) => a.toLowerCase());

  const adjectiveMapping: Record<string, Partial<Record<AestheticTheme, number>>> = {
    minimal: { minimal: 40 },
    clean: { minimal: 30 },
    simple: { minimal: 25 },
    warm: { warm: 40 },
    cozy: { warm: 35 },
    inviting: { warm: 30 },
    natural: { warm: 25, coastal: 15 },
    organic: { warm: 30 },
    bold: { bold: 40 },
    dramatic: { bold: 30, moody: 25 },
    luxe: { bold: 25, editorial: 20 },
    statement: { bold: 30 },
    moody: { moody: 40 },
    dark: { moody: 30 },
    atmospheric: { moody: 35 },
    rich: { moody: 25, warm: 15 },
    editorial: { editorial: 40 },
    refined: { editorial: 30, minimal: 15 },
    curated: { editorial: 25 },
    polished: { editorial: 25 },
    coastal: { coastal: 40 },
    serene: { coastal: 25, minimal: 20 },
    eclectic: { eclectic: 40 },
    collected: { eclectic: 35, warm: 15 },
    layered: { eclectic: 30 },
    playful: { eclectic: 25, bold: 15 },
  };

  adjectives.forEach((adj) => {
    const mapping = adjectiveMapping[adj];
    if (mapping) {
      Object.entries(mapping).forEach(([theme, points]) => {
        scores[theme as AestheticTheme] += points;
      });
    }
  });

  // Color temperature from brand colors
  if (brand.primaryColor) {
    const temp = getColorTemperatureFromHex(brand.primaryColor);
    if (temp === "warm") {
      scores.warm += 15;
    } else if (temp === "cool") {
      scores.minimal += 10;
      scores.coastal += 10;
    }
  }

  // Background color hints
  if (brand.backgroundColor) {
    const lightness = getColorLightness(brand.backgroundColor);
    if (lightness < 0.2) {
      scores.moody += 20;
    } else if (lightness > 0.9) {
      scores.minimal += 15;
    }
  }

  // Inspired by publications
  const pubMapping: Record<string, Partial<Record<AestheticTheme, number>>> = {
    "architectural digest": { editorial: 20 },
    "ad": { editorial: 20 },
    "elle decor": { editorial: 15, bold: 10 },
    "kinfolk": { minimal: 25, warm: 15 },
    "cereal": { minimal: 30 },
    "dwell": { minimal: 20, editorial: 10 },
    "world of interiors": { eclectic: 25, editorial: 15 },
    "milieu": { warm: 20, editorial: 15 },
    "luxe": { bold: 20, editorial: 15 },
  };

  brand.inspiredByPublications.forEach((pub) => {
    const lower = pub.toLowerCase();
    Object.entries(pubMapping).forEach(([key, mapping]) => {
      if (lower.includes(key)) {
        Object.entries(mapping).forEach(([theme, points]) => {
          scores[theme as AestheticTheme] += points;
        });
      }
    });
  });
}

function getColorTemperatureFromHex(hex: string): ColorTemperature {
  const rgb = hexToRgb(hex);
  if (!rgb) return "neutral";

  const warmth = (rgb.r * 1.0 + rgb.g * 0.5 - rgb.b * 0.5) / 255;
  if (warmth > 0.6) return "warm";
  if (warmth < 0.4) return "cool";
  return "neutral";
}

function getColorLightness(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0.5;
  return (rgb.r * 0.299 + rgb.g * 0.587 + rgb.b * 0.114) / 255;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

/**
 * Generate human-readable explanation of detection
 */
function generateExplanation(
  theme: AestheticTheme,
  signals: {
    colorTemperature: ColorTemperature;
    density: DensityLevel;
    contrast: ContrastLevel;
    dominantMaterials: string[];
    spatialStyle: string;
  },
  scores: Record<AestheticTheme, number>
): string {
  const topScore = scores[theme];
  const explanations: Record<AestheticTheme, string> = {
    minimal: `Your work emphasizes clean lines, generous whitespace, and restrained palettes. The ${signals.colorTemperature} color temperature and ${signals.contrast} contrast create a sense of calm and clarity.`,
    editorial: `Your projects have a sophisticated, magazine-worthy quality with ${signals.contrast} contrast and architectural emphasis. The ${signals.dominantMaterials.slice(0, 2).join(' and ')} materials add depth to your compositions.`,
    bold: `Your aesthetic is confident and expressive, with ${signals.contrast} contrast and dynamic compositions. The ${signals.dominantMaterials.slice(0, 2).join(' and ')} materials create strong visual statements.`,
    warm: `Your work feels inviting and natural, with ${signals.colorTemperature} tones and ${signals.dominantMaterials.slice(0, 2).join(' and ')} materials creating a cozy, lived-in atmosphere.`,
    coastal: `Your aesthetic evokes breezy, relaxed spaces with ${signals.colorTemperature} colors and natural materials. The ${signals.density} density creates an open, airy feeling.`,
    moody: `Your projects have depth and drama, with ${signals.contrast} contrast and ${signals.colorTemperature} tones creating atmospheric, contemplative spaces.`,
    eclectic: `Your work blends diverse influences and materials, with ${signals.dominantMaterials.slice(0, 3).join(', ')} creating a rich, layered aesthetic.`,
    default: `Your portfolio shows a balanced approach to design, with ${signals.colorTemperature} tones and ${signals.density} compositions.`,
  };
  
  return explanations[theme] || explanations.default;
}

/**
 * Main detection function
 */
export async function detectAesthetic(input: DetectionInput): Promise<AestheticProfile> {
  if (input.projects.length < 2) {
    return {
      theme: 'default',
      confidence: 0,
      signals: {
        colorTemperature: 'neutral',
        density: 'balanced',
        contrast: 'medium',
        dominantMaterials: [],
        spatialStyle: 'mixed',
      },
      explanation: 'Not enough projects to detect aesthetic. Upload at least 2 published projects.',
      alternativeThemes: [],
    };
  }
  
  // Extract all signals
  const allImageSignals: ImageSignals[] = [];
  const allProductTags: Array<{ product: { category?: string; materials?: string[] } }> = [];
  const allRooms: Array<{ type: string; materials?: string[] }> = [];
  const allDescriptions: string[] = [];
  
  for (const project of input.projects) {
    // Collect image signals
    for (const image of project.images) {
      if (image.precomputedSignals) {
        allImageSignals.push(image.precomputedSignals);
      } else {
        // Analyze image if not precomputed
        const signals = await analyzeImage(image.url);
        allImageSignals.push(signals);
      }
    }
    
    // Collect product tags
    if (project.productTags) {
      allProductTags.push(...project.productTags);
    }
    
    // Collect rooms
    if (project.rooms) {
      allRooms.push(...project.rooms);
    }
    
    // Collect descriptions
    if (project.description) {
      allDescriptions.push(project.description);
    }
  }
  
  // Extract aggregated signals
  const materialSignals = extractMaterialSignals(allProductTags, allRooms);
  const spatialSignals = extractSpatialSignals(
    allRooms,
    input.projects.flatMap(p => p.images)
  );
  const languageSignals = extractLanguageSignals(
    input.interviews || [],
    allDescriptions
  );
  
  // Initialize theme scores
  const scores: Record<AestheticTheme, number> = {
    minimal: 0,
    editorial: 0,
    bold: 0,
    warm: 0,
    coastal: 0,
    moody: 0,
    eclectic: 0,
    default: 0,
  };
  
  // Score from each signal type
  scoreFromImageSignals(allImageSignals, scores);
  scoreFromMaterialSignals(materialSignals, scores);
  scoreFromSpatialSignals(spatialSignals, scores);
  scoreFromLanguageSignals(languageSignals, scores);
  
  // Score from brand assets if present
  if (input.brandAssets) {
    scoreFromBrandAssets(input.brandAssets, scores);
  }
  
  // Determine theme (highest score)
  const sortedThemes = Object.entries(scores) as [AestheticTheme, number][];
  sortedThemes.sort((a, b) => b[1] - a[1]);
  
  const [theme, topScore] = sortedThemes[0];
  const maxPossibleScore = 150; // Rough estimate of max possible score
  const confidence = Math.min(topScore / maxPossibleScore, 1);
  
  // Get alternative themes (top 3 excluding the winner)
  const alternativeThemes = sortedThemes
    .slice(1, 4)
    .filter(([_, score]) => score > 0)
    .map(([t]) => t);
  
  // Determine density level
  let density: DensityLevel = 'balanced';
  if (spatialSignals.avgObjectDensity < 4) {
    density = 'sparse';
  } else if (spatialSignals.avgObjectDensity > 8) {
    density = 'dense';
  }
  
  // Determine contrast level (from image signals)
  let contrast: ContrastLevel = 'medium';
  const contrastCounts: Record<ContrastLevel, number> = { low: 0, medium: 0, high: 0 };
  for (const sig of allImageSignals) {
    contrastCounts[sig.contrast]++;
  }
  const dominantContrast = Object.entries(contrastCounts).sort((a, b) => b[1] - a[1])[0]?.[0] as ContrastLevel;
  contrast = dominantContrast || 'medium';
  
  // Determine color temperature
  const tempCounts: Record<ColorTemperature, number> = { cool: 0, neutral: 0, warm: 0 };
  for (const sig of allImageSignals) {
    tempCounts[sig.colorTemperature]++;
  }
  const colorTemperature = Object.entries(tempCounts).sort((a, b) => b[1] - a[1])[0]?.[0] as ColorTemperature || 'neutral';
  
  // Determine spatial style
  const roomTypeEntries = Object.entries(spatialSignals.roomTypes);
  const spatialStyle = roomTypeEntries.length > 0
    ? roomTypeEntries.sort((a, b) => b[1] - a[1])[0]?.[0] || 'mixed'
    : 'mixed';
  
  const signals = {
    colorTemperature,
    density,
    contrast,
    dominantMaterials: materialSignals.dominantMaterials,
    spatialStyle,
  };
  
  const explanation = generateExplanation(theme, signals, scores);
  
  return {
    theme,
    confidence,
    signals,
    explanation,
    alternativeThemes,
  };
}

