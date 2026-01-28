/**
 * Contribution Prompts
 * Manages contextual prompts shown to users at various locations
 */

import { prisma } from '@/lib/prisma';
import type { PromptLocation, PromptWithTopic } from './types';

/**
 * Get active prompts for a user at a specific location
 */
export async function getPromptsForLocation(
  userId: string | null,
  location: PromptLocation,
  limit: number = 3
): Promise<PromptWithTopic[]> {
  // Get user data if logged in
  let user = null;
  let userSaveCount = 0;
  let userDaysActive = 0;

  if (userId) {
    user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        createdAt: true,
      },
    });

    if (user) {
      userSaveCount = await prisma.save.count({
        where: { userId },
      });
      userDaysActive = Math.ceil(
        (Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24)
      );
    }
  }

  // Get prompts for this location
  const prompts = await prisma.contributionPrompt.findMany({
    where: {
      location,
      active: true,
      articleTopic: {
        status: 'GATHERING',
      },
      // Check impression limits
      OR: [
        { maxImpressions: null },
        {
          maxImpressions: {
            gt: prisma.contributionPrompt.fields.impressionCount,
          },
        },
      ],
    },
    orderBy: [
      { priority: 'desc' },
      { createdAt: 'desc' },
    ],
    include: {
      articleTopic: {
        select: {
          id: true,
          title: true,
          slug: true,
          promptQuestion: true,
          status: true,
          targetRoles: true,
          targetMaterials: true,
          targetStyles: true,
          minSaveCount: true,
          _count: {
            select: { contributions: true },
          },
        },
      },
    },
  });

  // Filter prompts based on targeting
  const matchedPrompts: PromptWithTopic[] = [];

  for (const prompt of prompts) {
    // Check role targeting (prompt level)
    if (prompt.targetRoles.length > 0 && user) {
      if (!prompt.targetRoles.includes(user.role)) {
        continue;
      }
    }

    // Check role targeting (topic level)
    if (prompt.articleTopic.targetRoles.length > 0 && user) {
      if (!prompt.articleTopic.targetRoles.includes(user.role)) {
        continue;
      }
    }

    // Check minimum save count
    const minSaves = prompt.minSaveCount ?? prompt.articleTopic.minSaveCount;
    if (minSaves && minSaves > 0) {
      if (!userId || userSaveCount < minSaves) {
        continue;
      }
    }

    // Check minimum days active
    if (prompt.minDaysActive && prompt.minDaysActive > 0) {
      if (!userId || userDaysActive < prompt.minDaysActive) {
        continue;
      }
    }

    // Check if user already contributed to this topic
    if (userId) {
      const existingContribution = await prisma.contribution.findUnique({
        where: {
          userId_articleTopicId: {
            userId,
            articleTopicId: prompt.articleTopicId,
          },
        },
        select: { id: true },
      });

      if (existingContribution) {
        continue; // Skip topics user has already contributed to
      }
    }

    matchedPrompts.push({
      id: prompt.id,
      location: prompt.location as PromptLocation,
      targetRoles: prompt.targetRoles,
      targetMaterials: prompt.targetMaterials,
      targetStyles: prompt.targetStyles,
      minSaveCount: prompt.minSaveCount,
      minDaysActive: prompt.minDaysActive,
      customQuestion: prompt.customQuestion,
      priority: prompt.priority,
      active: prompt.active,
      createdAt: prompt.createdAt,
      articleTopic: {
        id: prompt.articleTopic.id,
        title: prompt.articleTopic.title,
        slug: prompt.articleTopic.slug,
        promptQuestion: prompt.customQuestion || prompt.articleTopic.promptQuestion,
        status: prompt.articleTopic.status as any,
        contributionCount: prompt.articleTopic._count.contributions,
      },
    });

    if (matchedPrompts.length >= limit) {
      break;
    }
  }

  return matchedPrompts;
}

/**
 * Record a prompt impression
 */
export async function recordImpression(promptId: string): Promise<void> {
  await prisma.contributionPrompt.update({
    where: { id: promptId },
    data: {
      impressionCount: { increment: 1 },
    },
  });
}

/**
 * Record multiple prompt impressions at once
 */
export async function recordImpressions(promptIds: string[]): Promise<void> {
  if (promptIds.length === 0) return;

  await prisma.contributionPrompt.updateMany({
    where: { id: { in: promptIds } },
    data: {
      impressionCount: { increment: 1 },
    },
  });
}

/**
 * Create a default prompt when a topic is activated
 */
export async function createDefaultPrompt(
  articleTopicId: string,
  location: PromptLocation = 'MAGAZINE_PAGE'
): Promise<void> {
  const topic = await prisma.articleTopic.findUnique({
    where: { id: articleTopicId },
    select: {
      targetRoles: true,
      targetMaterials: true,
      targetStyles: true,
      minSaveCount: true,
    },
  });

  if (!topic) return;

  await prisma.contributionPrompt.create({
    data: {
      location,
      articleTopicId,
      targetRoles: topic.targetRoles,
      targetMaterials: topic.targetMaterials,
      targetStyles: topic.targetStyles,
      minSaveCount: topic.minSaveCount,
      priority: 0,
      active: true,
    },
  });
}

/**
 * Deactivate all prompts for a topic
 */
export async function deactivateTopicPrompts(articleTopicId: string): Promise<void> {
  await prisma.contributionPrompt.updateMany({
    where: { articleTopicId },
    data: { active: false },
  });
}
