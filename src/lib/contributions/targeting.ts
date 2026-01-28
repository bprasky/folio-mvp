/**
 * Contribution Targeting
 * Matches users to article topics based on their role, interests, and engagement
 */

import { prisma } from '@/lib/prisma';
import type { ArticleTopicWithStats } from './types';

/**
 * Get GATHERING topics that match a user's profile
 */
export async function getTopicsForUser(
  userId: string | null
): Promise<ArticleTopicWithStats[]> {
  // Get user data if logged in
  let user = null;
  let userSaves: { productAttributes: any }[] = [];
  let userTasteProfile = null;

  if (userId) {
    user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        createdAt: true,
      },
    });

    // Get user's saves with product attributes
    userSaves = await prisma.save.findMany({
      where: { userId },
      select: { productAttributes: true },
      take: 100,
    });

    // Get user's taste profile
    userTasteProfile = await prisma.userTasteProfile.findUnique({
      where: { userId },
      select: {
        confirmedAttributes: true,
      },
    });
  }

  // Get all GATHERING topics
  const topics = await prisma.articleTopic.findMany({
    where: { status: 'GATHERING' },
    orderBy: [
      { targetPublishDate: 'asc' },
      { gatheringStartedAt: 'desc' },
    ],
    include: {
      _count: {
        select: { contributions: true },
      },
      contributions: user ? {
        where: { userId: user.id },
        select: {
          id: true,
          userId: true,
          userRole: true,
          type: true,
          content: true,
          status: true,
          createdAt: true,
        },
        take: 1,
      } : false,
    },
  });

  // Filter topics based on targeting criteria
  const matchedTopics: ArticleTopicWithStats[] = [];

  for (const topic of topics) {
    // Check role targeting
    if (topic.targetRoles.length > 0 && user) {
      if (!topic.targetRoles.includes(user.role)) {
        continue; // Skip if user's role doesn't match
      }
    }

    // Check minimum save count
    if (topic.minSaveCount && topic.minSaveCount > 0) {
      if (!userId || userSaves.length < topic.minSaveCount) {
        continue; // Skip if user doesn't have enough saves
      }
    }

    // Check material/style targeting (optional - if user has related saves)
    if (topic.targetMaterials.length > 0 && userSaves.length > 0) {
      const hasMatchingMaterial = userSaves.some((save) => {
        const attrs = save.productAttributes as { materials?: string[] } | null;
        if (!attrs?.materials) return false;
        return topic.targetMaterials.some((targetMaterial) =>
          attrs.materials!.some((m) => m.toLowerCase().includes(targetMaterial.toLowerCase()))
        );
      });
      // Don't skip, just prioritize matching users
    }

    if (topic.targetStyles.length > 0 && userSaves.length > 0) {
      const hasMatchingStyle = userSaves.some((save) => {
        const attrs = save.productAttributes as { styles?: string[] } | null;
        if (!attrs?.styles) return false;
        return topic.targetStyles.some((targetStyle) =>
          attrs.styles!.some((s) => s.toLowerCase().includes(targetStyle.toLowerCase()))
        );
      });
      // Don't skip, just prioritize matching users
    }

    // Get contribution breakdown by role
    const contributions = await prisma.contribution.groupBy({
      by: ['userRole'],
      where: { articleTopicId: topic.id },
      _count: true,
    });

    const roleCountMap = contributions.reduce((acc, c) => {
      acc[c.userRole] = c._count;
      return acc;
    }, {} as Record<string, number>);

    matchedTopics.push({
      id: topic.id,
      title: topic.title,
      slug: topic.slug,
      promptQuestion: topic.promptQuestion,
      description: topic.description,
      category: topic.category,
      tags: topic.tags,
      targetRoles: topic.targetRoles,
      targetMaterials: topic.targetMaterials,
      targetStyles: topic.targetStyles,
      minSaveCount: topic.minSaveCount,
      minContributions: topic.minContributions,
      targetContributions: topic.targetContributions,
      minDesigners: topic.minDesigners,
      minReps: topic.minReps,
      minIndividuals: topic.minIndividuals,
      status: topic.status,
      autoTriggered: topic.autoTriggered,
      queuedAt: topic.queuedAt,
      gatheringStartedAt: topic.gatheringStartedAt,
      targetPublishDate: topic.targetPublishDate,
      createdAt: topic.createdAt,
      updatedAt: topic.updatedAt,
      contributionCount: topic._count.contributions,
      designerCount: roleCountMap['DESIGNER'] || 0,
      vendorCount: roleCountMap['VENDOR'] || 0,
      individualCount: roleCountMap['INDIVIDUAL'] || 0,
      userContribution: topic.contributions && topic.contributions.length > 0
        ? {
            id: topic.contributions[0].id,
            userId: topic.contributions[0].userId,
            userRole: topic.contributions[0].userRole,
            type: topic.contributions[0].type as any,
            content: topic.contributions[0].content,
            status: topic.contributions[0].status as any,
            createdAt: topic.contributions[0].createdAt,
          }
        : null,
    });
  }

  return matchedTopics;
}

/**
 * Check if a specific user qualifies for a specific topic
 */
export async function matchUserToTopic(
  userId: string,
  articleTopicId: string
): Promise<{ matches: boolean; reason?: string }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
      createdAt: true,
    },
  });

  if (!user) {
    return { matches: false, reason: 'User not found' };
  }

  const topic = await prisma.articleTopic.findUnique({
    where: { id: articleTopicId },
    select: {
      id: true,
      status: true,
      targetRoles: true,
      targetMaterials: true,
      targetStyles: true,
      minSaveCount: true,
    },
  });

  if (!topic) {
    return { matches: false, reason: 'Topic not found' };
  }

  if (topic.status !== 'GATHERING') {
    return { matches: false, reason: 'Topic is not accepting contributions' };
  }

  // Check role
  if (topic.targetRoles.length > 0 && !topic.targetRoles.includes(user.role)) {
    return { matches: false, reason: 'Your role is not eligible for this topic' };
  }

  // Check minimum saves
  if (topic.minSaveCount && topic.minSaveCount > 0) {
    const saveCount = await prisma.save.count({
      where: { userId },
    });
    if (saveCount < topic.minSaveCount) {
      return { matches: false, reason: `You need at least ${topic.minSaveCount} saved products` };
    }
  }

  // Check if already contributed
  const existingContribution = await prisma.contribution.findUnique({
    where: {
      userId_articleTopicId: { userId, articleTopicId },
    },
  });

  if (existingContribution) {
    return { matches: false, reason: 'You have already contributed to this topic' };
  }

  return { matches: true };
}

/**
 * Get personalized topic recommendations based on user's taste profile
 */
export async function getForYouTopics(
  userId: string,
  limit: number = 3
): Promise<ArticleTopicWithStats[]> {
  // Get user's taste inferences
  const tasteInferences = await prisma.tasteInference.findMany({
    where: {
      userId,
      confirmedByUser: { not: false }, // Include unconfirmed and confirmed
      confidence: { gte: 0.5 }, // Only high-confidence inferences
    },
    select: {
      attribute: true,
      attributeType: true,
      confidence: true,
    },
    orderBy: { confidence: 'desc' },
    take: 20,
  });

  // Get user's saved product materials/styles
  const saves = await prisma.save.findMany({
    where: { userId },
    select: { productAttributes: true },
    take: 50,
  });

  const userMaterials = new Set<string>();
  const userStyles = new Set<string>();

  // Extract from taste inferences
  for (const inference of tasteInferences) {
    if (inference.attributeType === 'material') {
      userMaterials.add(inference.attribute.toLowerCase());
    } else if (inference.attributeType === 'style') {
      userStyles.add(inference.attribute.toLowerCase());
    }
  }

  // Extract from saves
  for (const save of saves) {
    const attrs = save.productAttributes as { materials?: string[]; styles?: string[] } | null;
    if (attrs?.materials) {
      attrs.materials.forEach((m) => userMaterials.add(m.toLowerCase()));
    }
    if (attrs?.styles) {
      attrs.styles.forEach((s) => userStyles.add(s.toLowerCase()));
    }
  }

  // Get all gathering topics the user hasn't contributed to
  const topics = await getTopicsForUser(userId);

  // Filter to topics user hasn't contributed to
  const uncommittedTopics = topics.filter((t) => !t.userContribution);

  // Score topics based on relevance
  const scoredTopics = uncommittedTopics.map((topic) => {
    let score = 0;

    // Score based on matching materials
    for (const targetMaterial of topic.targetMaterials) {
      if (userMaterials.has(targetMaterial.toLowerCase())) {
        score += 10;
      }
    }

    // Score based on matching styles
    for (const targetStyle of topic.targetStyles) {
      if (userStyles.has(targetStyle.toLowerCase())) {
        score += 10;
      }
    }

    // Score based on tags matching inferences
    for (const tag of topic.tags) {
      if (userMaterials.has(tag.toLowerCase()) || userStyles.has(tag.toLowerCase())) {
        score += 5;
      }
    }

    // Boost topics near threshold
    const progress = topic.contributionCount / topic.targetContributions;
    if (progress >= 0.5 && progress < 1) {
      score += 5;
    }

    // Boost topics with upcoming publish date
    if (topic.targetPublishDate) {
      const daysUntil = Math.ceil(
        (topic.targetPublishDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );
      if (daysUntil > 0 && daysUntil <= 7) {
        score += 10;
      } else if (daysUntil > 7 && daysUntil <= 14) {
        score += 5;
      }
    }

    return { topic, score };
  });

  // Sort by score and return top N
  scoredTopics.sort((a, b) => b.score - a.score);
  return scoredTopics.slice(0, limit).map((st) => st.topic);
}
