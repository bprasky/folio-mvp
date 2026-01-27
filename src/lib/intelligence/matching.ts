/**
 * Designer Matching for Intelligence System
 * See docs/12_INTELLIGENCE_SYSTEM.md - Layer 5: Designer Matching
 */

import { prisma } from '@/lib/prisma';
import { AtelierNodeType, AtelierOwnerType } from '@prisma/client';
import type { DesignerMatch, ProductAttributes } from './types';

/**
 * Build a user's fingerprint vector from their likes and saves
 * Returns a normalized vector for similarity comparison
 */
async function buildUserFingerprintVector(userId: string): Promise<Record<string, number>> {
  const vector: Record<string, number> = {};

  // Get user's likes and saves with attributes
  const [likes, saves] = await Promise.all([
    prisma.like.findMany({
      where: { userId },
      select: { productAttributes: true },
    }),
    prisma.save.findMany({
      where: { userId },
      select: { productAttributes: true },
    }),
  ]);

  // Weight saves more heavily (2x) than likes
  const weightedSignals = [
    ...likes.map(l => ({ attrs: l.productAttributes as ProductAttributes | null, weight: 1 })),
    ...saves.map(s => ({ attrs: s.productAttributes as ProductAttributes | null, weight: 2 })),
  ];

  // Aggregate attributes into vector
  for (const signal of weightedSignals) {
    if (!signal.attrs) continue;

    // Add style signals
    for (const style of signal.attrs.styles || []) {
      const key = `style:${style.toLowerCase()}`;
      vector[key] = (vector[key] || 0) + signal.weight;
    }

    // Add material signals
    for (const material of signal.attrs.materials || []) {
      const key = `material:${material.toLowerCase()}`;
      vector[key] = (vector[key] || 0) + signal.weight;
    }

    // Add color signals
    for (const color of signal.attrs.colors || []) {
      const key = `color:${color.toLowerCase()}`;
      vector[key] = (vector[key] || 0) + signal.weight;
    }

    // Add shape signals
    for (const shape of signal.attrs.shapes || []) {
      const key = `shape:${shape.toLowerCase()}`;
      vector[key] = (vector[key] || 0) + signal.weight;
    }
  }

  // Normalize the vector
  const maxValue = Math.max(...Object.values(vector), 1);
  for (const key of Object.keys(vector)) {
    vector[key] = vector[key] / maxValue;
  }

  return vector;
}

/**
 * Build a designer's fingerprint vector from their AtelierNodes
 */
async function getDesignerFingerprintVector(
  fingerprintId: string
): Promise<Record<string, number>> {
  const nodes = await prisma.atelierNode.findMany({
    where: { fingerprintId },
    select: {
      nodeType: true,
      label: true,
      weight: true,
    },
  });

  const vector: Record<string, number> = {};

  for (const node of nodes) {
    // Map node types to vector keys
    let prefix = '';
    switch (node.nodeType) {
      case AtelierNodeType.STYLE:
        prefix = 'style:';
        break;
      case AtelierNodeType.MATERIAL:
        prefix = 'material:';
        break;
      case AtelierNodeType.ROOM_TYPE:
        // Room types map to style preferences
        prefix = 'room:';
        break;
      case AtelierNodeType.VENDOR:
        // Skip vendors for matching (too specific)
        continue;
      case AtelierNodeType.PRODUCT_CATEGORY:
        prefix = 'category:';
        break;
      default:
        continue;
    }

    const key = `${prefix}${node.label.toLowerCase()}`;
    vector[key] = node.weight;
  }

  return vector;
}

/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(
  vectorA: Record<string, number>,
  vectorB: Record<string, number>
): number {
  const allKeys = new Set([...Object.keys(vectorA), ...Object.keys(vectorB)]);

  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (const key of allKeys) {
    const a = vectorA[key] || 0;
    const b = vectorB[key] || 0;

    dotProduct += a * b;
    magnitudeA += a * a;
    magnitudeB += b * b;
  }

  magnitudeA = Math.sqrt(magnitudeA);
  magnitudeB = Math.sqrt(magnitudeB);

  if (magnitudeA === 0 || magnitudeB === 0) {
    return 0;
  }

  return dotProduct / (magnitudeA * magnitudeB);
}

/**
 * Find shared attributes between user and designer
 */
function findSharedAttributes(
  userVector: Record<string, number>,
  designerVector: Record<string, number>
): string[] {
  const shared: { key: string; score: number }[] = [];

  for (const key of Object.keys(userVector)) {
    if (designerVector[key] && designerVector[key] > 0.3) {
      shared.push({
        key: key.split(':')[1] || key,
        score: Math.min(userVector[key], designerVector[key]),
      });
    }
  }

  return shared
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(s => s.key);
}

/**
 * Match a user with designers based on taste profile
 */
export async function matchDesigners(
  userId: string,
  options?: {
    limit?: number;
    minScore?: number;
  }
): Promise<DesignerMatch[]> {
  const { limit = 10, minScore = 0.3 } = options || {};

  // Build user fingerprint vector
  const userVector = await buildUserFingerprintVector(userId);

  if (Object.keys(userVector).length === 0) {
    return [];
  }

  // Get all designers with fingerprints
  const designers = await prisma.user.findMany({
    where: {
      role: 'DESIGNER',
    },
    select: {
      id: true,
      name: true,
    },
  });

  const designerFingerprints = await prisma.atelierFingerprint.findMany({
    where: {
      ownerType: AtelierOwnerType.DESIGNER,
      designerId: { in: designers.map(d => d.id) },
      completeness: { gt: 0.1 }, // Only consider designers with meaningful fingerprints
    },
    select: {
      id: true,
      designerId: true,
    },
  });

  const fingerprintMap = new Map(
    designerFingerprints.map(f => [f.designerId, f.id])
  );

  // Calculate similarity scores
  const matches: DesignerMatch[] = [];

  for (const designer of designers) {
    const fingerprintId = fingerprintMap.get(designer.id);
    if (!fingerprintId) continue;

    const designerVector = await getDesignerFingerprintVector(fingerprintId);

    if (Object.keys(designerVector).length === 0) continue;

    const similarity = cosineSimilarity(userVector, designerVector);

    if (similarity >= minScore) {
      matches.push({
        designerId: designer.id,
        designerName: designer.name,
        matchScore: similarity,
        matchPercentage: Math.round(similarity * 100),
        sharedAttributes: findSharedAttributes(userVector, designerVector),
      });
    }
  }

  // Sort by score and limit
  return matches
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, limit);
}

/**
 * Get a single designer's compatibility with a user
 */
export async function getDesignerCompatibility(
  userId: string,
  designerId: string
): Promise<DesignerMatch | null> {
  const userVector = await buildUserFingerprintVector(userId);

  if (Object.keys(userVector).length === 0) {
    return null;
  }

  const fingerprint = await prisma.atelierFingerprint.findFirst({
    where: {
      ownerType: AtelierOwnerType.DESIGNER,
      designerId,
    },
    select: {
      id: true,
    },
  });

  if (!fingerprint) {
    return null;
  }

  const designer = await prisma.user.findUnique({
    where: { id: designerId },
    select: { name: true },
  });

  if (!designer) {
    return null;
  }

  const designerVector = await getDesignerFingerprintVector(fingerprint.id);
  const similarity = cosineSimilarity(userVector, designerVector);

  return {
    designerId,
    designerName: designer.name,
    matchScore: similarity,
    matchPercentage: Math.round(similarity * 100),
    sharedAttributes: findSharedAttributes(userVector, designerVector),
  };
}

/**
 * Update user's fingerprint vector in their taste profile
 * Called after pattern detection to keep the vector fresh
 */
export async function updateUserFingerprintVector(userId: string): Promise<void> {
  const vector = await buildUserFingerprintVector(userId);

  await prisma.userTasteProfile.upsert({
    where: { userId },
    create: {
      userId,
      fingerprintVector: vector,
    },
    update: {
      fingerprintVector: vector,
    },
  });
}
