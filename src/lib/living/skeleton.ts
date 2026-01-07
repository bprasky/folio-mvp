// src/lib/living/skeleton.ts
//
// Skeleton Item Generation and Management
//
// Generates stub skeleton items for past projects until real CV/SAM integration.

import { prisma } from '@/lib/prisma';

export interface SkeletonItem {
  id: string;
  projectId: string;
  projectImageId: string;
  roomName: string | null;
  bbox: { x: number; y: number; w: number; h: number };
  label: string;
  confidence: number;
  status: 'UNCONFIRMED' | 'CONFIRMED' | 'DISMISSED';
  createdBy: 'AI' | 'HUMAN';
  confirmedProductId: string | null;
  confirmedLabel: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Deterministic seeded random number generator
 * Uses projectImageId as seed for consistent bbox generation
 */
function seededRandom(seed: string): () => number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  let value = Math.abs(hash);
  
  return () => {
    value = (value * 9301 + 49297) % 233280;
    return value / 233280;
  };
}

/**
 * Generate deterministic bounding boxes for an image
 * Returns 3-8 bboxes with normalized coordinates (0-1)
 */
function generateBoundingBoxes(
  projectImageId: string,
  count: number = 5
): Array<{ x: number; y: number; w: number; h: number }> {
  const rng = seededRandom(projectImageId);
  const boxes: Array<{ x: number; y: number; w: number; h: number }> = [];
  
  // Clamp count between 3-8
  const numBoxes = Math.max(3, Math.min(8, count));
  
  for (let i = 0; i < numBoxes; i++) {
    // Generate random position and size
    const x = rng() * 0.7; // Keep within 0-0.7 to ensure box fits
    const y = rng() * 0.7;
    const w = 0.15 + rng() * 0.25; // Width: 0.15-0.4
    const h = 0.15 + rng() * 0.25; // Height: 0.15-0.4
    
    // Ensure box stays within bounds
    const clampedX = Math.min(x, 1 - w);
    const clampedY = Math.min(y, 1 - h);
    
    boxes.push({
      x: clampedX,
      y: clampedY,
      w: Math.min(w, 1 - clampedX),
      h: Math.min(h, 1 - clampedY),
    });
  }
  
  return boxes;
}

/**
 * Ensure skeleton items exist for an image
 * Only creates if they don't already exist (status UNCONFIRMED or CONFIRMED)
 */
export async function ensureSkeletonItemsForImage(
  projectImageId: string
): Promise<void> {
  try {
    // Check if skeleton items already exist
    const existing = await prisma.skeletonItem.findMany({
      where: {
        projectImageId,
        status: {
          in: ['UNCONFIRMED', 'CONFIRMED'],
        },
      },
      take: 1,
    });
    
    if (existing.length > 0) {
      // Already has skeleton items, skip
      return;
    }
    
    // Load image with project to check conditions
    const image = await prisma.projectImage.findUnique({
      where: { id: projectImageId },
      include: {
        project: {
          select: {
            id: true,
            intent: true,
            livingEnabled: true,
            livingOptOut: true,
          },
        },
      },
    });
    
    if (!image || !image.project) {
      return;
    }
    
    // Check feature flag (or dev bypass)
    const featureEnabled = process.env.NEXT_PUBLIC_FOLIO_SKELETON_TAGS === 'true';
    const devBypass = process.env.NODE_ENV !== 'production' || process.env.FOLIO_SKELETONS_DEV === 'true';
    
    if (!featureEnabled && !devBypass) {
      console.log('[skeleton] skipped - feature flag disabled', {
        projectId: image.projectId,
        imageId: projectImageId,
        flag: process.env.NEXT_PUBLIC_FOLIO_SKELETON_TAGS,
        devBypass,
      });
      return;
    }
    
    // Always respect opt-out (never run if opted out)
    if (image.project.livingOptOut) {
      console.log('[skeleton] skipped - project opted out', {
        projectId: image.projectId,
        imageId: projectImageId,
        livingOptOut: image.project.livingOptOut,
      });
      return;
    }
    
    // In dev/demo: bypass intent and livingEnabled gates
    // In prod: keep existing gates
    if (process.env.NODE_ENV === 'production' && !process.env.FOLIO_SKELETONS_DEV) {
      // Production: enforce all gates
      if (
        image.project.intent !== 'PAST' ||
        !image.project.livingEnabled
      ) {
        console.log('[skeleton] skipped - production gates', {
          projectId: image.projectId,
          imageId: projectImageId,
          intent: image.project.intent,
          livingEnabled: image.project.livingEnabled,
        });
        return;
      }
    } else {
      // Dev/demo: only log if gates would have blocked (for debugging)
      if (image.project.intent !== 'PAST' || !image.project.livingEnabled) {
        console.log('[skeleton] dev bypass - would be blocked in prod', {
          projectId: image.projectId,
          imageId: projectImageId,
          intent: image.project.intent,
          livingEnabled: image.project.livingEnabled,
          devBypass: true,
        });
      }
    }
    
    // Generate bounding boxes
    const rng = seededRandom(projectImageId);
    const numBoxes = 3 + Math.floor(rng() * 6); // 3-8 boxes
    const bboxes = generateBoundingBoxes(projectImageId, numBoxes);
    
    // Create skeleton items
    const items = bboxes.map((bbox) => ({
      projectId: image.projectId,
      projectImageId: image.id,
      roomName: image.room || null,
      bbox: bbox,
      label: 'unconfirmed',
      confidence: 0.35 + rng() * 0.3, // 0.35-0.65
      status: 'UNCONFIRMED' as const,
      createdBy: 'AI' as const,
    }));
    
    await prisma.skeletonItem.createMany({
      data: items,
    });
    
    console.log('[skeleton] generating', {
      projectId: image.projectId,
      imageId: projectImageId,
      count: items.length,
    });
  } catch (error) {
    // Never block upload on skeleton generation failure
    console.error('[skeleton] Failed to generate skeleton items:', error);
  }
}

/**
 * Get all skeleton items for an image
 */
export async function getSkeletonItemsForImage(
  projectImageId: string
): Promise<SkeletonItem[]> {
  const items = await prisma.skeletonItem.findMany({
    where: {
      projectImageId,
      status: {
        in: ['UNCONFIRMED', 'CONFIRMED'],
      },
    },
    orderBy: {
      createdAt: 'asc',
    },
  });
  
  return items as SkeletonItem[];
}

/**
 * Get skeleton items for a project (owner/admin only)
 */
export async function getSkeletonItemsForProject(
  projectId: string
): Promise<SkeletonItem[]> {
  const items = await prisma.skeletonItem.findMany({
    where: {
      projectId,
      status: {
        in: ['UNCONFIRMED', 'CONFIRMED'],
      },
    },
    include: {
      projectImage: {
        select: {
          id: true,
          url: true,
        },
      },
    },
    orderBy: {
      createdAt: 'asc',
    },
  });
  
  return items as SkeletonItem[];
}




