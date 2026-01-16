/**
 * Directory Ranking Management
 * Handles rank recalculation, updates, and history tracking
 */

import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import {
  calculateDesignerScores,
  calculateVendorScores,
  calculateDesignerTotalScore,
  calculateVendorTotalScore,
} from './scoring';
import { isDesignerDirectoryEligible, isVendorDirectoryEligible } from './eligibility';
import type { RankingType, ScoreUpdateTrigger } from './types';

/**
 * Update a designer's ranking scores and position
 */
export async function updateDesignerRanking(
  userId: string,
  trigger?: ScoreUpdateTrigger
): Promise<{ success: boolean; rank: number | null; rankChange: number }> {
  // Calculate new scores
  const scores = await calculateDesignerScores(userId);
  const totalScore = calculateDesignerTotalScore(scores);

  // Get user's subscription status
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      role: true,
      subscriptionTier: true,
      subscriptionExpiresAt: true,
    },
  });

  if (!user) {
    return { success: false, rank: null, rankChange: 0 };
  }

  const isEligible = isDesignerDirectoryEligible(user);

  // Use transaction to ensure consistency
  const result = await prisma.$transaction(async (tx) => {
    // Get current ranking
    const current = await tx.directoryRanking.findUnique({
      where: { userId },
    });

    // Upsert the ranking
    const updated = await tx.directoryRanking.upsert({
      where: { userId },
      create: {
        userId,
        rankingType: 'DESIGNER',
        taggedProjectsScore: scores.taggedProjectsScore,
        completenessScore: scores.completenessScore,
        engagementScore: scores.engagementScore,
        editorialScore: scores.editorialScore,
        vendorDiversityScore: scores.vendorDiversityScore,
        recencyScore: scores.recencyScore,
        totalScore,
        isEligible,
        lastCalculatedAt: new Date(),
      },
      update: {
        taggedProjectsScore: scores.taggedProjectsScore,
        completenessScore: scores.completenessScore,
        engagementScore: scores.engagementScore,
        editorialScore: scores.editorialScore,
        vendorDiversityScore: scores.vendorDiversityScore,
        recencyScore: scores.recencyScore,
        totalScore,
        previousRank: current?.rank,
        isEligible,
        lastCalculatedAt: new Date(),
      },
    });

    return { updated, previousRank: current?.rank };
  });

  // Recalculate all ranks (this could be optimized with a more targeted approach)
  await recalculateRanks('DESIGNER');

  // Get the final rank after recalculation
  const finalRanking = await prisma.directoryRanking.findUnique({
    where: { userId },
    select: { rank: true, previousRank: true, rankChange: true },
  });

  // Record history if rank changed significantly
  if (finalRanking?.rank && result.previousRank !== finalRanking.rank) {
    const ranking = await prisma.directoryRanking.findUnique({
      where: { userId },
    });

    if (ranking) {
      await prisma.rankingHistory.create({
        data: {
          rankingId: ranking.id,
          rank: finalRanking.rank,
          totalScore,
        },
      });
    }
  }

  return {
    success: true,
    rank: finalRanking?.rank ?? null,
    rankChange: finalRanking?.rankChange ?? 0,
  };
}

/**
 * Update a vendor organization's ranking scores and position
 */
export async function updateVendorRanking(
  vendorOrgId: string
): Promise<{ success: boolean; rank: number | null; rankChange: number }> {
  // Calculate new scores
  const scores = await calculateVendorScores(vendorOrgId);
  const totalScore = calculateVendorTotalScore(scores);

  // Get org's status
  const org = await prisma.organization.findUnique({
    where: { id: vendorOrgId },
    select: {
      type: true,
      status: true,
    },
  });

  if (!org) {
    return { success: false, rank: null, rankChange: 0 };
  }

  const isEligible = isVendorDirectoryEligible(org);

  // Use transaction
  const result = await prisma.$transaction(async (tx) => {
    const current = await tx.directoryRanking.findUnique({
      where: { vendorOrgId },
    });

    const updated = await tx.directoryRanking.upsert({
      where: { vendorOrgId },
      create: {
        vendorOrgId,
        rankingType: 'VENDOR',
        designerTagsScore: scores.designerTagsScore,
        projectInclusionScore: scores.projectInclusionScore,
        saveScore: scores.saveScore,
        catalogCompletenessScore: scores.catalogCompletenessScore,
        totalScore,
        isEligible,
        lastCalculatedAt: new Date(),
      },
      update: {
        designerTagsScore: scores.designerTagsScore,
        projectInclusionScore: scores.projectInclusionScore,
        saveScore: scores.saveScore,
        catalogCompletenessScore: scores.catalogCompletenessScore,
        totalScore,
        previousRank: current?.rank,
        isEligible,
        lastCalculatedAt: new Date(),
      },
    });

    return { updated, previousRank: current?.rank };
  });

  // Recalculate all vendor ranks
  await recalculateRanks('VENDOR');

  // Get the final rank
  const finalRanking = await prisma.directoryRanking.findUnique({
    where: { vendorOrgId },
    select: { rank: true, previousRank: true, rankChange: true },
  });

  return {
    success: true,
    rank: finalRanking?.rank ?? null,
    rankChange: finalRanking?.rankChange ?? 0,
  };
}

/**
 * Recalculate ranks for all entries of a given type
 */
export async function recalculateRanks(type: RankingType): Promise<void> {
  // Get all eligible and visible rankings ordered by score
  const rankings = await prisma.directoryRanking.findMany({
    where: {
      rankingType: type,
      isEligible: true,
      isVisible: true,
    },
    orderBy: { totalScore: 'desc' },
    select: { id: true, rank: true },
  });

  // Batch update ranks
  const updates: Prisma.PrismaPromise<unknown>[] = [];

  for (let i = 0; i < rankings.length; i++) {
    const newRank = i + 1;
    const ranking = rankings[i];

    if (ranking.rank !== newRank) {
      updates.push(
        prisma.directoryRanking.update({
          where: { id: ranking.id },
          data: {
            previousRank: ranking.rank,
            rank: newRank,
            rankChange: (ranking.rank ?? newRank) - newRank,
          },
        })
      );
    }
  }

  // Also set rank to null for non-eligible/non-visible entries
  updates.push(
    prisma.directoryRanking.updateMany({
      where: {
        rankingType: type,
        OR: [{ isEligible: false }, { isVisible: false }],
        rank: { not: null },
      },
      data: {
        previousRank: null,
        rank: null,
        rankChange: 0,
      },
    })
  );

  // Execute all updates
  if (updates.length > 0) {
    await prisma.$transaction(updates);
  }
}

/**
 * Get rising designers (biggest movers in last 7 days)
 */
export async function getRisingDesigners(limit: number = 10): Promise<
  Array<{
    userId: string;
    rank: number;
    rankChange: number;
    totalScore: number;
  }>
> {
  const rankings = await prisma.directoryRanking.findMany({
    where: {
      rankingType: 'DESIGNER',
      isEligible: true,
      isVisible: true,
      rank: { not: null },
      rankChange: { gt: 0 }, // Only positive movement (moved up)
    },
    orderBy: { rankChange: 'desc' },
    take: limit,
    select: {
      userId: true,
      rank: true,
      rankChange: true,
      totalScore: true,
    },
  });

  return rankings.map((r) => ({
    userId: r.userId!,
    rank: r.rank!,
    rankChange: r.rankChange,
    totalScore: r.totalScore,
  }));
}

/**
 * Get rising vendors (biggest movers)
 */
export async function getRisingVendors(limit: number = 10): Promise<
  Array<{
    vendorOrgId: string;
    rank: number;
    rankChange: number;
    totalScore: number;
  }>
> {
  const rankings = await prisma.directoryRanking.findMany({
    where: {
      rankingType: 'VENDOR',
      isEligible: true,
      isVisible: true,
      rank: { not: null },
      rankChange: { gt: 0 },
    },
    orderBy: { rankChange: 'desc' },
    take: limit,
    select: {
      vendorOrgId: true,
      rank: true,
      rankChange: true,
      totalScore: true,
    },
  });

  return rankings.map((r) => ({
    vendorOrgId: r.vendorOrgId!,
    rank: r.rank!,
    rankChange: r.rankChange,
    totalScore: r.totalScore,
  }));
}

/**
 * Batch recalculate all designer rankings
 * Used for scheduled updates or initial population
 */
export async function batchRecalculateDesignerRankings(): Promise<{ processed: number }> {
  // Get all designers with professional roles
  const designers = await prisma.user.findMany({
    where: {
      role: { in: ['DESIGNER', 'ARCHITECT', 'BUILDER'] },
    },
    select: { id: true },
  });

  let processed = 0;

  for (const designer of designers) {
    await updateDesignerRanking(designer.id);
    processed++;
  }

  return { processed };
}

/**
 * Batch recalculate all vendor rankings
 */
export async function batchRecalculateVendorRankings(): Promise<{ processed: number }> {
  const vendors = await prisma.organization.findMany({
    where: {
      type: { in: ['VENDOR', 'MANUFACTURER', 'SHOWROOM'] },
    },
    select: { id: true },
  });

  let processed = 0;

  for (const vendor of vendors) {
    await updateVendorRanking(vendor.id);
    processed++;
  }

  return { processed };
}
