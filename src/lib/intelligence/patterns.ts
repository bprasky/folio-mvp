/**
 * Pattern Inference for Intelligence System
 * See docs/12_INTELLIGENCE_SYSTEM.md - Layer 2: Pattern Inference
 */

import { prisma } from '@/lib/prisma';
import {
  ProductAttributes,
  TasteInferenceData,
  PatternDetectionResult,
  StyleSignature,
  ENGAGEMENT_MILESTONES,
} from './types';

// Attribute type mapping for common attributes
const ATTRIBUTE_TYPE_MAP: Record<string, 'color' | 'material' | 'shape' | 'style'> = {
  // Colors
  'white': 'color', 'black': 'color', 'gray': 'color', 'grey': 'color',
  'beige': 'color', 'cream': 'color', 'ivory': 'color', 'tan': 'color',
  'brown': 'color', 'navy': 'color', 'blue': 'color', 'green': 'color',
  'red': 'color', 'pink': 'color', 'orange': 'color', 'yellow': 'color',
  'purple': 'color', 'gold': 'color', 'silver': 'color', 'brass': 'color',
  'copper': 'color', 'terracotta': 'color', 'olive': 'color', 'sage': 'color',
  'blush': 'color', 'charcoal': 'color', 'natural': 'color',

  // Materials
  'wood': 'material', 'oak': 'material', 'walnut': 'material', 'teak': 'material',
  'marble': 'material', 'stone': 'material', 'granite': 'material', 'travertine': 'material',
  'metal': 'material', 'steel': 'material', 'iron': 'material', 'aluminum': 'material',
  'velvet': 'material', 'linen': 'material', 'cotton': 'material', 'wool': 'material',
  'leather': 'material', 'rattan': 'material', 'wicker': 'material', 'bamboo': 'material',
  'glass': 'material', 'ceramic': 'material', 'porcelain': 'material', 'concrete': 'material',
  'terrazzo': 'material', 'brick': 'material', 'plaster': 'material', 'lacquer': 'material',

  // Shapes
  'curved': 'shape', 'angular': 'shape', 'organic': 'shape', 'geometric': 'shape',
  'round': 'shape', 'square': 'shape', 'rectangular': 'shape', 'oval': 'shape',
  'linear': 'shape', 'sculptural': 'shape', 'flowing': 'shape', 'tapered': 'shape',
  'arched': 'shape', 'boxy': 'shape', 'streamlined': 'shape',

  // Styles
  'modern': 'style', 'contemporary': 'style', 'traditional': 'style', 'transitional': 'style',
  'minimalist': 'style', 'maximalist': 'style', 'mid-century': 'style', 'art deco': 'style',
  'coastal': 'style', 'mediterranean': 'style', 'scandinavian': 'style', 'japandi': 'style',
  'bohemian': 'style', 'industrial': 'style', 'rustic': 'style', 'farmhouse': 'style',
  'glam': 'style', 'eclectic': 'style', 'hollywood regency': 'style', 'french country': 'style',
};

/**
 * Infer attribute type from the attribute string
 */
function inferAttributeType(attribute: string): 'color' | 'material' | 'shape' | 'style' {
  const lower = attribute.toLowerCase();
  return ATTRIBUTE_TYPE_MAP[lower] || 'style';
}

/**
 * Count attribute occurrences across signals
 */
function countAttributes(
  signals: { productAttributes: ProductAttributes | null }[]
): Record<string, number> {
  const counts: Record<string, number> = {};

  for (const signal of signals) {
    if (!signal.productAttributes) continue;

    const attrs = signal.productAttributes;
    for (const color of attrs.colors || []) {
      counts[color.toLowerCase()] = (counts[color.toLowerCase()] || 0) + 1;
    }
    for (const material of attrs.materials || []) {
      counts[material.toLowerCase()] = (counts[material.toLowerCase()] || 0) + 1;
    }
    for (const shape of attrs.shapes || []) {
      counts[shape.toLowerCase()] = (counts[shape.toLowerCase()] || 0) + 1;
    }
    for (const style of attrs.styles || []) {
      counts[style.toLowerCase()] = (counts[style.toLowerCase()] || 0) + 1;
    }
  }

  return counts;
}

/**
 * Group signals by a specific attribute
 */
function groupBy<T>(items: T[], keyFn: (item: T) => string | undefined): Record<string, T[]> {
  const groups: Record<string, T[]> = {};

  for (const item of items) {
    const key = keyFn(item);
    if (!key) continue;
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
  }

  return groups;
}

/**
 * Get unique values from an array
 */
function unique(items: (string | undefined)[]): string[] {
  return [...new Set(items.filter((x): x is string => !!x))];
}

/**
 * Compute a style signature from signals using clustering
 */
function computeStyleSignature(
  signals: { productAttributes: ProductAttributes | null }[]
): StyleSignature {
  const styleCounts: Record<string, number> = {};

  for (const signal of signals) {
    if (!signal.productAttributes?.styles) continue;
    for (const style of signal.productAttributes.styles) {
      styleCounts[style.toLowerCase()] = (styleCounts[style.toLowerCase()] || 0) + 1;
    }
  }

  const sorted = Object.entries(styleCounts).sort(([, a], [, b]) => b - a);

  if (sorted.length === 0) {
    return { dominantStyle: null, confidence: 0, matchingItems: 0 };
  }

  const [topStyle, topCount] = sorted[0];
  const totalWithStyles = signals.filter(s => s.productAttributes?.styles?.length).length;

  return {
    dominantStyle: topStyle,
    confidence: totalWithStyles > 0 ? topCount / totalWithStyles : 0,
    matchingItems: topCount,
  };
}

/**
 * Detect taste patterns from user's signals
 * This is the core pattern inference algorithm
 */
export async function detectTastePatterns(userId: string): Promise<PatternDetectionResult> {
  // Get recent likes and saves
  const [likes, saves] = await Promise.all([
    prisma.like.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { productAttributes: true },
    }),
    prisma.save.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { productAttributes: true },
    }),
  ]);

  const allSignals = [
    ...likes.map(l => ({ productAttributes: l.productAttributes as ProductAttributes | null })),
    ...saves.map(s => ({ productAttributes: s.productAttributes as ProductAttributes | null })),
  ];

  if (allSignals.length < 3) {
    return {
      inferences: [],
      signalCount: allSignals.length,
      lastUpdated: new Date(),
    };
  }

  const inferences: TasteInferenceData[] = [];

  // 1. FREQUENCY PATTERNS
  const attributeCounts = countAttributes(allSignals);

  for (const [attribute, count] of Object.entries(attributeCounts)) {
    if (count >= 3) {
      const confidence = Math.min(count / allSignals.length, 1);
      inferences.push({
        attribute,
        attributeType: inferAttributeType(attribute),
        confidence,
        evidence: `Appeared in ${count} of ${allSignals.length} items`,
        source: 'frequency',
      });
    }
  }

  // 2. CROSS-PATTERNS
  // Same shape, different colors = shape preference
  const signalsWithShape = allSignals.filter(s => s.productAttributes?.shapes?.length);
  const byShape = groupBy(signalsWithShape, s => s.productAttributes?.shapes?.[0]?.toLowerCase());

  for (const [shape, items] of Object.entries(byShape)) {
    if (items.length >= 2) {
      const uniqueColors = unique(items.flatMap(i => i.productAttributes?.colors?.map(c => c.toLowerCase()) || []));
      if (uniqueColors.length >= 2) {
        // Check if this shape pattern isn't already in frequency patterns with higher confidence
        const existingShape = inferences.find(i => i.attribute === shape && i.attributeType === 'shape');
        if (!existingShape) {
          inferences.push({
            attribute: shape,
            attributeType: 'shape',
            confidence: 0.8,
            evidence: `Saved ${shape} items in ${uniqueColors.length} different colors`,
            source: 'cross_pattern',
          });
        }
      }
    }
  }

  // Same color, different shapes = color preference
  const signalsWithColor = allSignals.filter(s => s.productAttributes?.colors?.length);
  const byColor = groupBy(signalsWithColor, s => s.productAttributes?.colors?.[0]?.toLowerCase());

  for (const [color, items] of Object.entries(byColor)) {
    if (items.length >= 2) {
      const uniqueShapes = unique(items.flatMap(i => i.productAttributes?.shapes?.map(s => s.toLowerCase()) || []));
      if (uniqueShapes.length >= 2) {
        const existingColor = inferences.find(i => i.attribute === color && i.attributeType === 'color');
        if (!existingColor) {
          inferences.push({
            attribute: color,
            attributeType: 'color',
            confidence: 0.8,
            evidence: `Saved ${color} across ${uniqueShapes.length} different shapes`,
            source: 'cross_pattern',
          });
        }
      }
    }
  }

  // 3. STYLE CLUSTERING
  const styleSignature = computeStyleSignature(allSignals);
  if (styleSignature.dominantStyle && styleSignature.confidence > 0.3) {
    const existingStyle = inferences.find(
      i => i.attribute === styleSignature.dominantStyle && i.attributeType === 'style'
    );
    if (!existingStyle) {
      inferences.push({
        attribute: styleSignature.dominantStyle,
        attributeType: 'style',
        confidence: styleSignature.confidence,
        evidence: `${styleSignature.matchingItems} items match ${styleSignature.dominantStyle} aesthetic`,
        source: 'clustering',
      });
    }
  }

  // Sort by confidence
  inferences.sort((a, b) => b.confidence - a.confidence);

  return {
    inferences,
    signalCount: allSignals.length,
    lastUpdated: new Date(),
  };
}

/**
 * Queue pattern detection for a user (non-blocking)
 * In production, this would be a background job
 */
export async function queuePatternDetection(userId: string): Promise<void> {
  // For now, run synchronously but don't await in caller
  // In production, this would enqueue to a job system

  try {
    const result = await detectTastePatterns(userId);

    if (result.inferences.length === 0) return;

    // Store new inferences
    for (const inference of result.inferences) {
      await prisma.tasteInference.upsert({
        where: {
          userId_attribute: {
            userId,
            attribute: inference.attribute,
          },
        },
        create: {
          userId,
          attribute: inference.attribute,
          attributeType: inference.attributeType,
          confidence: inference.confidence,
          evidence: inference.evidence,
          source: inference.source,
        },
        update: {
          confidence: inference.confidence,
          evidence: inference.evidence,
          source: inference.source,
        },
      });
    }

    // Check for milestones
    const profile = await prisma.userTasteProfile.findUnique({
      where: { userId },
      select: { totalSaves: true, firstInsightAt: true },
    });

    if (profile) {
      // First insight milestone
      if (!profile.firstInsightAt && profile.totalSaves >= ENGAGEMENT_MILESTONES.FIRST_INSIGHT) {
        await prisma.userTasteProfile.update({
          where: { userId },
          data: { firstInsightAt: new Date() },
        });
      }

      // Update profile strength
      const confirmedCount = await prisma.tasteInference.count({
        where: { userId, confirmedByUser: true },
      });

      const totalInferences = await prisma.tasteInference.count({
        where: { userId },
      });

      const profileStrength = totalInferences > 0
        ? (confirmedCount / totalInferences) * Math.min(profile.totalSaves / 25, 1)
        : 0;

      await prisma.userTasteProfile.update({
        where: { userId },
        data: { profileStrength },
      });
    }
  } catch (error) {
    console.error('[Pattern Detection] Error:', error);
  }
}

/**
 * Get pending inferences (not yet shown to user) for confirmation
 */
export async function getPendingInferences(
  userId: string,
  limit: number = 3
): Promise<TasteInferenceData[]> {
  const inferences = await prisma.tasteInference.findMany({
    where: {
      userId,
      shownToUser: false,
      confirmedByUser: null,
    },
    orderBy: { confidence: 'desc' },
    take: limit,
  });

  return inferences.map(i => ({
    attribute: i.attribute,
    attributeType: i.attributeType as 'color' | 'material' | 'shape' | 'style',
    confidence: i.confidence,
    evidence: i.evidence,
    source: i.source as 'frequency' | 'cross_pattern' | 'clustering',
  }));
}

/**
 * Confirm or deny an inference
 */
export async function confirmInference(params: {
  userId: string;
  inferenceId: string;
  response: 'confirm' | 'deny' | 'skip';
}): Promise<{ success: boolean }> {
  const { userId, inferenceId, response } = params;

  const inference = await prisma.tasteInference.findFirst({
    where: { id: inferenceId, userId },
  });

  if (!inference) {
    return { success: false };
  }

  const updateData: {
    shownToUser: boolean;
    shownAt: Date;
    confirmedByUser?: boolean;
    confirmedAt?: Date;
    dismissedAt?: Date;
  } = {
    shownToUser: true,
    shownAt: new Date(),
  };

  if (response === 'confirm') {
    updateData.confirmedByUser = true;
    updateData.confirmedAt = new Date();

    // Add to confirmed attributes
    await prisma.userTasteProfile.update({
      where: { userId },
      data: {
        confirmedAttributes: {
          push: inference.attribute,
        },
      },
    });
  } else if (response === 'deny') {
    updateData.confirmedByUser = false;
    updateData.confirmedAt = new Date();
  } else {
    // Skip - just mark as shown but don't confirm/deny
    updateData.dismissedAt = new Date();
  }

  await prisma.tasteInference.update({
    where: { id: inferenceId },
    data: updateData,
  });

  return { success: true };
}

/**
 * Get user's confirmed taste attributes
 */
export async function getConfirmedTastes(userId: string): Promise<{
  confirmed: TasteInferenceData[];
  unconfirmed: TasteInferenceData[];
}> {
  const [confirmed, unconfirmed] = await Promise.all([
    prisma.tasteInference.findMany({
      where: { userId, confirmedByUser: true },
      orderBy: { confidence: 'desc' },
    }),
    prisma.tasteInference.findMany({
      where: { userId, confirmedByUser: null },
      orderBy: { confidence: 'desc' },
    }),
  ]);

  return {
    confirmed: confirmed.map(i => ({
      attribute: i.attribute,
      attributeType: i.attributeType as 'color' | 'material' | 'shape' | 'style',
      confidence: i.confidence,
      evidence: i.evidence,
      source: i.source as 'frequency' | 'cross_pattern' | 'clustering',
    })),
    unconfirmed: unconfirmed.map(i => ({
      attribute: i.attribute,
      attributeType: i.attributeType as 'color' | 'material' | 'shape' | 'style',
      confidence: i.confidence,
      evidence: i.evidence,
      source: i.source as 'frequency' | 'cross_pattern' | 'clustering',
    })),
  };
}
