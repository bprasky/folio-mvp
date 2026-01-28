/**
 * Contributor Badges
 * Manages badge awarding based on published contribution counts
 */

import { prisma } from '@/lib/prisma';
import type { BadgeLevel } from './types';
import { BADGE_THRESHOLDS, ROLE_TO_BADGE_5 } from './types';

/**
 * Check and award badges for a user based on their published contributions
 */
export async function checkAndAwardBadges(userId: string): Promise<{
  newBadges: BadgeLevel[];
  currentLevel: BadgeLevel | null;
}> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
      publishedContributionCount: true,
      contributionCount: true,
      contributorLevel: true,
      contributorBadges: {
        select: { level: true },
      },
    },
  });

  if (!user) {
    return { newBadges: [], currentLevel: null };
  }

  const publishedCount = user.publishedContributionCount;
  const totalCount = user.contributionCount;
  const existingBadges = new Set(user.contributorBadges.map((b) => b.level));
  const newBadges: BadgeLevel[] = [];

  // Check VOICE badge (1 published)
  if (publishedCount >= BADGE_THRESHOLDS.VOICE && !existingBadges.has('VOICE')) {
    await awardBadge(userId, 'VOICE', publishedCount, totalCount);
    newBadges.push('VOICE');
  }

  // Check role-specific 5-publish badge
  if (publishedCount >= BADGE_THRESHOLDS.PERSPECTIVE) {
    const roleBadge = ROLE_TO_BADGE_5[user.role];
    if (roleBadge && !existingBadges.has(roleBadge)) {
      await awardBadge(userId, roleBadge, publishedCount, totalCount);
      newBadges.push(roleBadge);
    }
  }

  // Check AUTHORITY badge (15 published)
  if (publishedCount >= BADGE_THRESHOLDS.AUTHORITY && !existingBadges.has('AUTHORITY')) {
    await awardBadge(userId, 'AUTHORITY', publishedCount, totalCount);
    newBadges.push('AUTHORITY');
  }

  // Check EDITORIAL_VOICE badge (30 published)
  if (publishedCount >= BADGE_THRESHOLDS.EDITORIAL_VOICE && !existingBadges.has('EDITORIAL_VOICE')) {
    await awardBadge(userId, 'EDITORIAL_VOICE', publishedCount, totalCount);
    newBadges.push('EDITORIAL_VOICE');
  }

  // Determine current highest level
  const currentLevel = getHighestBadgeLevel(publishedCount, user.role);

  // Update user's contributor level if changed
  if (currentLevel !== user.contributorLevel) {
    await prisma.user.update({
      where: { id: userId },
      data: { contributorLevel: currentLevel },
    });
  }

  return { newBadges, currentLevel };
}

/**
 * Award a specific badge to a user
 */
async function awardBadge(
  userId: string,
  level: BadgeLevel,
  publishedCount: number,
  totalContributions: number
): Promise<void> {
  await prisma.contributorBadge.upsert({
    where: {
      userId_level: { userId, level },
    },
    create: {
      userId,
      level,
      publishedCount,
      totalContributions,
    },
    update: {
      publishedCount,
      totalContributions,
    },
  });
}

/**
 * Get the highest badge level a user qualifies for
 */
export function getHighestBadgeLevel(publishedCount: number, role: string): BadgeLevel | null {
  if (publishedCount >= BADGE_THRESHOLDS.EDITORIAL_VOICE) {
    return 'EDITORIAL_VOICE';
  }
  if (publishedCount >= BADGE_THRESHOLDS.AUTHORITY) {
    return 'AUTHORITY';
  }
  if (publishedCount >= BADGE_THRESHOLDS.PERSPECTIVE) {
    return ROLE_TO_BADGE_5[role] || 'PERSPECTIVE';
  }
  if (publishedCount >= BADGE_THRESHOLDS.VOICE) {
    return 'VOICE';
  }
  return null;
}

/**
 * Get the appropriate badge for a role at 5 publications
 */
export function getBadgeForRole(role: string, count: number): BadgeLevel | null {
  if (count >= BADGE_THRESHOLDS.EDITORIAL_VOICE) {
    return 'EDITORIAL_VOICE';
  }
  if (count >= BADGE_THRESHOLDS.AUTHORITY) {
    return 'AUTHORITY';
  }
  if (count >= BADGE_THRESHOLDS.PERSPECTIVE) {
    return ROLE_TO_BADGE_5[role] || 'PERSPECTIVE';
  }
  if (count >= BADGE_THRESHOLDS.VOICE) {
    return 'VOICE';
  }
  return null;
}

/**
 * Get a user's contributor profile with badges
 */
export async function getContributorProfile(userId: string): Promise<{
  badges: {
    level: BadgeLevel;
    earnedAt: Date;
    publishedCount: number;
    totalContributions: number;
  }[];
  contributionCount: number;
  publishedContributionCount: number;
  contributorLevel: BadgeLevel | null;
}> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      contributionCount: true,
      publishedContributionCount: true,
      contributorLevel: true,
      contributorBadges: {
        select: {
          level: true,
          earnedAt: true,
          publishedCount: true,
          totalContributions: true,
        },
        orderBy: { earnedAt: 'desc' },
      },
    },
  });

  if (!user) {
    return {
      badges: [],
      contributionCount: 0,
      publishedContributionCount: 0,
      contributorLevel: null,
    };
  }

  return {
    badges: user.contributorBadges.map((b) => ({
      level: b.level as BadgeLevel,
      earnedAt: b.earnedAt,
      publishedCount: b.publishedCount,
      totalContributions: b.totalContributions,
    })),
    contributionCount: user.contributionCount,
    publishedContributionCount: user.publishedContributionCount,
    contributorLevel: user.contributorLevel as BadgeLevel | null,
  };
}

/**
 * Get the next badge level a user can earn
 */
export function getNextBadgeLevel(
  publishedCount: number,
  role: string
): { level: BadgeLevel; remaining: number } | null {
  if (publishedCount < BADGE_THRESHOLDS.VOICE) {
    return {
      level: 'VOICE',
      remaining: BADGE_THRESHOLDS.VOICE - publishedCount,
    };
  }

  if (publishedCount < BADGE_THRESHOLDS.PERSPECTIVE) {
    const roleBadge = ROLE_TO_BADGE_5[role] || 'PERSPECTIVE';
    return {
      level: roleBadge,
      remaining: BADGE_THRESHOLDS.PERSPECTIVE - publishedCount,
    };
  }

  if (publishedCount < BADGE_THRESHOLDS.AUTHORITY) {
    return {
      level: 'AUTHORITY',
      remaining: BADGE_THRESHOLDS.AUTHORITY - publishedCount,
    };
  }

  if (publishedCount < BADGE_THRESHOLDS.EDITORIAL_VOICE) {
    return {
      level: 'EDITORIAL_VOICE',
      remaining: BADGE_THRESHOLDS.EDITORIAL_VOICE - publishedCount,
    };
  }

  return null; // Already at max level
}
