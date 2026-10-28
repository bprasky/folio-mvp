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

  // Load ProjectPost.
  //
  // `dynamicHeroUpdatedAt` is NOT selected: ProjectPost has no such column. It
  // was both written and read here, so the write threw (the hero was never
  // applied) and the read below was always undefined — meaning the 7-day
  // guardrail never actually held anything back.
  //
  // The timestamp it wanted is already persisted, in `expandedBlocks.living
  // .updatedAt`, which this function stamps on every application. Reading it
  // from there keeps the guardrail working without a migration.
  const post = await prisma.projectPost.findUnique({
    where: { projectId },
    select: {
      id: true,
      status: true,
      heroAssetId: true,
      expandedBlocks: true,
      updatedAt: true,
    },
  });

  // Only update published posts
  if (!post || post.status !== 'PUBLISHED') {
    return;
  }

  // Check guardrail: don't update if updated within last 7 days
  const lastAppliedRaw = (post.expandedBlocks as any)?.living?.updatedAt;
  const lastApplied = lastAppliedRaw ? new Date(lastAppliedRaw) : null;
  if (lastApplied && !Number.isNaN(lastApplied.getTime())) {
    const daysSinceUpdate = (Date.now() - lastApplied.getTime()) / (1000 * 60 * 60 * 24);
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

  // Update ProjectPost.
  //
  // No `dynamicHeroUpdatedAt`: ProjectPost has no such column, so this update
  // threw PrismaClientValidationError and the hero was never actually applied.
  // The guardrail timestamp lives in `expandedBlocks.living.updatedAt`, stamped
  // just above and read back at the top of this function.
  await prisma.projectPost.updateMany({
    where: { projectId, updatedAt: post.updatedAt },
    data: {
      heroAssetId: feature.heroAssetId,
      expandedBlocks,
    },
  });
}








