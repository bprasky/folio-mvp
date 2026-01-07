// src/lib/living/applyDynamicHero.ts
//
// Dynamic Hero Asset Updater
//
// Updates ProjectPost.heroAssetId based on room gravity scores.

import { prisma } from '@/lib/prisma';
import { pickFeatureRoomForProjectPost } from './gravity';

const DAYS_BETWEEN_UPDATES = 7;

/**
 * Apply dynamic hero asset for a project
 * Updates ProjectPost.heroAssetId based on room gravity, with guardrails
 */
export async function applyDynamicHeroForProject(
  projectId: string
): Promise<void> {
  // Check feature flag
  const featureEnabled = process.env.NEXT_PUBLIC_FOLIO_DYNAMIC_FEED_ENTRY === 'true';
  if (!featureEnabled) {
    return;
  }

  // Load ProjectPost
  const post = await prisma.projectPost.findUnique({
    where: { projectId },
    select: {
      id: true,
      status: true,
      heroAssetId: true,
      dynamicHeroUpdatedAt: true,
      expandedBlocks: true,
    },
  });

  // Only update published posts
  if (!post || post.status !== 'PUBLISHED') {
    return;
  }

  // Check guardrail: don't update if updated within last 7 days
  if (post.dynamicHeroUpdatedAt) {
    const daysSinceUpdate = (Date.now() - post.dynamicHeroUpdatedAt.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceUpdate < DAYS_BETWEEN_UPDATES) {
      return;
    }
  }

  // Pick feature room
  const feature = await pickFeatureRoomForProjectPost(projectId);
  
  if (!feature || !feature.heroAssetId) {
    return;
  }

  // Only update if heroAssetId changed
  if (post.heroAssetId === feature.heroAssetId) {
    return;
  }

  // Parse expandedBlocks or initialize
  let expandedBlocks: any = post.expandedBlocks;
  if (!expandedBlocks || typeof expandedBlocks !== 'object') {
    expandedBlocks = {};
  }

  // Update expandedBlocks with living metadata
  expandedBlocks.living = {
    featureRoomName: feature.roomName,
    updatedAt: new Date().toISOString(),
  };

  // Update ProjectPost
  await prisma.projectPost.update({
    where: { projectId },
    data: {
      heroAssetId: feature.heroAssetId,
      dynamicHeroUpdatedAt: new Date(),
      expandedBlocks,
    },
  });
}








