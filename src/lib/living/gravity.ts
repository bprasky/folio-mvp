// src/lib/living/gravity.ts
//
// Room Gravity Computation
//
// Computes room-level engagement gravity scores for dynamic feed entry images.

import { prisma } from '@/lib/prisma';

export interface RoomGravityScore {
  roomName: string;
  score: number;
  heroImageId?: string;
}

/**
 * Compute room gravity scores for a project
 * v1 implementation: simple scoring based on image count and confirmed tag count
 */
export async function computeProjectRoomGravity(
  projectId: string
): Promise<RoomGravityScore[]> {
  // Load project to check feature flag
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      livingEnabled: true,
      livingOptOut: true,
    },
  });

  if (!project || !project.livingEnabled || project.livingOptOut) {
    return [];
  }

  // Load images grouped by room
  const images = await prisma.projectImage.findMany({
    where: { projectId },
    select: {
      id: true,
      room: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  // Load confirmed project product tags (grouped by room)
  const confirmedTags = await prisma.projectProductTag.findMany({
    where: {
      projectId,
      projectImage: {
        isNot: null,
      },
    },
    include: {
      projectImage: {
        select: {
          id: true,
          room: true,
        },
      },
    },
  });

  // Group images by room
  const roomImageMap = new Map<string, Array<{ id: string; createdAt: Date }>>();
  
  for (const image of images) {
    const roomName = image.room || 'unknown';
    if (!roomImageMap.has(roomName)) {
      roomImageMap.set(roomName, []);
    }
    roomImageMap.get(roomName)!.push({
      id: image.id,
      createdAt: image.createdAt,
    });
  }

  // Count confirmed tags per room
  const roomTagCountMap = new Map<string, number>();
  
  for (const tag of confirmedTags) {
    const roomName = tag.roomName || tag.projectImage?.room || 'unknown';
    roomTagCountMap.set(roomName, (roomTagCountMap.get(roomName) || 0) + 1);
  }

  // Compute scores
  const scores: RoomGravityScore[] = [];
  
  for (const [roomName, roomImages] of roomImageMap.entries()) {
    const imageCount = roomImages.length;
    const confirmedTagCount = roomTagCountMap.get(roomName) || 0;
    
    // v1 formula: imageCount * 1.0 + confirmedTagCount * 2.0
    const score = imageCount * 1.0 + confirmedTagCount * 2.0;
    
    // Pick first image as hero (by creation order)
    const heroImageId = roomImages[0]?.id;
    
    scores.push({
      roomName,
      score,
      heroImageId,
    });
  }

  // Sort by score descending
  scores.sort((a, b) => b.score - a.score);

  return scores;
}

/**
 * Pick the feature room for a project post based on gravity
 * Returns heroAssetId and roomName for the highest-scoring room
 */
export async function pickFeatureRoomForProjectPost(
  projectId: string
): Promise<{ heroAssetId?: string; roomName?: string } | undefined> {
  // Check feature flag
  const featureEnabled = process.env.NEXT_PUBLIC_FOLIO_ROOM_GRAVITY === 'true';
  if (!featureEnabled) {
    return undefined;
  }

  // Load project to check living enabled
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      livingEnabled: true,
      livingOptOut: true,
    },
  });

  if (!project || !project.livingEnabled || project.livingOptOut) {
    return undefined;
  }

  // Compute gravity scores
  const scores = await computeProjectRoomGravity(projectId);

  if (scores.length === 0) {
    return undefined;
  }

  // Pick highest score
  const topRoom = scores[0];

  if (!topRoom.heroImageId) {
    return undefined;
  }

  return {
    heroAssetId: topRoom.heroImageId,
    roomName: topRoom.roomName,
  };
}








