/**
 * Signal Recording for Intelligence System
 * See docs/12_INTELLIGENCE_SYSTEM.md - Layer 1: Signal Capture
 */

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { ProductAttributes, SIGNAL_WEIGHTS } from './types';
import { queuePatternDetection } from './patterns';

/**
 * Extract product attributes for a product
 * Uses existing MomentIndex data when available
 */
export async function getProductAttributes(productId: string): Promise<ProductAttributes | null> {
  // First check if product has tags in a project image with MomentIndex
  const productTag = await prisma.productTag.findFirst({
    where: { productId },
    include: {
      image: {
        include: {
          momentIndex: true,
        },
      },
    },
  });

  if (productTag?.image?.momentIndex) {
    const index = productTag.image.momentIndex;
    return {
      colors: index.colors,
      materials: index.materials,
      shapes: [], // MomentIndex doesn't have shapes, derive from elements
      styles: index.styles,
      category: index.categories[0] || undefined,
    };
  }

  // Fall back to product's AI classification on project images
  const projectImageWithProduct = await prisma.projectImage.findFirst({
    where: {
      tags: {
        some: { productId },
      },
      aiClassification: { not: Prisma.DbNull },
    },
    select: {
      aiClassification: true,
      aiColors: true,
      aiMaterials: true,
    },
  });

  if (projectImageWithProduct?.aiClassification) {
    const classification = projectImageWithProduct.aiClassification as {
      colors?: string[];
      materials?: string[];
      styles?: string[];
      elements?: string[];
    };

    return {
      colors: classification.colors || (projectImageWithProduct.aiColors as { hex: string; name: string }[] || []).map(c => c.name),
      materials: classification.materials || projectImageWithProduct.aiMaterials || [],
      shapes: extractShapesFromElements(classification.elements || []),
      styles: classification.styles || [],
      category: undefined,
    };
  }

  // No attributes available
  return null;
}

/**
 * Extract shape descriptors from element descriptions
 */
function extractShapesFromElements(elements: string[]): string[] {
  const shapeKeywords = [
    'curved', 'angular', 'organic', 'geometric', 'round', 'square',
    'rectangular', 'oval', 'linear', 'sculptural', 'flowing', 'tapered',
  ];

  const shapes: string[] = [];
  for (const element of elements) {
    const lower = element.toLowerCase();
    for (const shape of shapeKeywords) {
      if (lower.includes(shape) && !shapes.includes(shape)) {
        shapes.push(shape);
      }
    }
  }

  return shapes;
}

/**
 * Record a like signal
 */
export async function recordLike(params: {
  userId: string;
  productId: string;
}): Promise<{ success: boolean; isNew: boolean }> {
  const { userId, productId } = params;

  // Check if already liked
  const existing = await prisma.like.findUnique({
    where: {
      userId_productId: { userId, productId },
    },
  });

  if (existing) {
    return { success: true, isNew: false };
  }

  // Get product attributes
  const productAttributes = await getProductAttributes(productId);

  // Create the like
  await prisma.like.create({
    data: {
      userId,
      productId,
      productAttributes: productAttributes || undefined,
    },
  });

  // Update user taste profile stats
  await prisma.userTasteProfile.upsert({
    where: { userId },
    create: {
      userId,
      totalLikes: 1,
    },
    update: {
      totalLikes: { increment: 1 },
    },
  });

  // Queue pattern detection (non-blocking)
  queuePatternDetection(userId).catch(console.error);

  return { success: true, isNew: true };
}

/**
 * Remove a like
 */
export async function removeLike(params: {
  userId: string;
  productId: string;
}): Promise<{ success: boolean }> {
  const { userId, productId } = params;

  const deleted = await prisma.like.deleteMany({
    where: { userId, productId },
  });

  if (deleted.count > 0) {
    await prisma.userTasteProfile.updateMany({
      where: { userId },
      data: { totalLikes: { decrement: 1 } },
    });
  }

  return { success: true };
}

/**
 * Record a save signal
 */
export async function recordSave(params: {
  userId: string;
  productId: string;
  boardId?: string;
  roomType?: string;
  source?: string;
  meta?: any;
}): Promise<{ success: boolean; isNew: boolean; saveId?: string }> {
  const { userId, productId, boardId, roomType, source, meta } = params;

  // Check if already saved
  const existing = await prisma.save.findUnique({
    where: {
      userId_productId: { userId, productId },
    },
  });

  if (existing) {
    // Update board/room if provided
    if (boardId || roomType) {
      await prisma.save.update({
        where: { id: existing.id },
        data: {
          boardId: boardId || existing.boardId,
          roomType: roomType || existing.roomType,
        },
      });
    }
    return { success: true, isNew: false, saveId: existing.id };
  }

  // Get product attributes
  const productAttributes = await getProductAttributes(productId);

  // Create the save
  const save = await prisma.save.create({
    data: {
      userId,
      productId,
      boardId,
      roomType,
      productAttributes: productAttributes || undefined,
      source: source || undefined,
      meta: meta || undefined,
    },
  });

  // Update user taste profile stats
  await prisma.userTasteProfile.upsert({
    where: { userId },
    create: {
      userId,
      totalSaves: 1,
    },
    update: {
      totalSaves: { increment: 1 },
    },
  });

  // Queue pattern detection (non-blocking)
  queuePatternDetection(userId).catch(console.error);

  return { success: true, isNew: true, saveId: save.id };
}

/**
 * Remove a save
 */
export async function removeSave(params: {
  userId: string;
  productId: string;
}): Promise<{ success: boolean }> {
  const { userId, productId } = params;

  const deleted = await prisma.save.deleteMany({
    where: { userId, productId },
  });

  if (deleted.count > 0) {
    await prisma.userTasteProfile.updateMany({
      where: { userId },
      data: { totalSaves: { decrement: 1 } },
    });
  }

  return { success: true };
}

/**
 * Get user's likes
 */
export async function getUserLikes(
  userId: string,
  options?: { limit?: number; offset?: number }
): Promise<{ id: string; productId: string; createdAt: Date; productAttributes: ProductAttributes | null }[]> {
  const likes = await prisma.like.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: options?.limit || 50,
    skip: options?.offset || 0,
  });

  return likes.map(like => ({
    id: like.id,
    productId: like.productId,
    createdAt: like.createdAt,
    productAttributes: like.productAttributes as ProductAttributes | null,
  }));
}

/**
 * Get user's saves
 */
export async function getUserSaves(
  userId: string,
  options?: { limit?: number; offset?: number; boardId?: string }
): Promise<{
  id: string;
  productId: string;
  boardId: string | null;
  roomType: string | null;
  createdAt: Date;
  productAttributes: ProductAttributes | null;
}[]> {
  const saves = await prisma.save.findMany({
    where: {
      userId,
      ...(options?.boardId && { boardId: options.boardId }),
    },
    orderBy: { createdAt: 'desc' },
    take: options?.limit || 50,
    skip: options?.offset || 0,
  });

  return saves.map(save => ({
    id: save.id,
    productId: save.productId,
    boardId: save.boardId,
    roomType: save.roomType,
    createdAt: save.createdAt,
    productAttributes: save.productAttributes as ProductAttributes | null,
  }));
}

/**
 * Check if user has liked a product
 */
export async function hasUserLiked(userId: string, productId: string): Promise<boolean> {
  const like = await prisma.like.findUnique({
    where: { userId_productId: { userId, productId } },
    select: { id: true },
  });
  return !!like;
}

/**
 * Check if user has saved a product
 */
export async function hasUserSaved(userId: string, productId: string): Promise<boolean> {
  const save = await prisma.save.findUnique({
    where: { userId_productId: { userId, productId } },
    select: { id: true },
  });
  return !!save;
}

/**
 * Get engagement counts for a product
 */
export async function getProductEngagement(productId: string): Promise<{
  likeCount: number;
  saveCount: number;
}> {
  const [likeCount, saveCount] = await Promise.all([
    prisma.like.count({ where: { productId } }),
    prisma.save.count({ where: { productId } }),
  ]);

  return { likeCount, saveCount };
}
