/**
 * Contribution Notifications
 * Handles notifying users about contribution events
 */

import { prisma } from '@/lib/prisma';

/**
 * Notify a user that their contribution was published
 */
export async function notifyContributionPublished(
  contributionId: string
): Promise<void> {
  const contribution = await prisma.contribution.findUnique({
    where: { id: contributionId },
    include: {
      user: {
        select: { id: true, name: true, email: true },
      },
      articleTopic: {
        select: { id: true, title: true, slug: true },
      },
      publishedInPost: {
        select: { id: true, slug: true },
      },
    },
  });

  if (!contribution) {
    console.warn(`[notifyContributionPublished] Contribution not found: ${contributionId}`);
    return;
  }

  // Count other contributors
  const otherContributors = await prisma.contribution.count({
    where: {
      articleTopicId: contribution.articleTopicId,
      status: 'PUBLISHED',
      id: { not: contributionId },
    },
  });

  const articleUrl = contribution.publishedInPost?.slug
    ? `/p/${contribution.publishedInPost.slug}`
    : `/article-topics/${contribution.articleTopic.slug}`;

  // Create in-app notification
  await prisma.notification.create({
    data: {
      userId: contribution.userId,
      type: 'CONTRIBUTION_PUBLISHED',
      title: 'Your voice is live',
      body: `You're quoted in "${contribution.articleTopic.title}"${
        otherContributors > 0 ? ` alongside ${otherContributors} others` : ''
      }.`,
      actionUrl: articleUrl,
      metadata: {
        articleTitle: contribution.articleTopic.title,
        contributionId: contribution.id,
        articleTopicId: contribution.articleTopicId,
        shareCardUrl: contribution.shareCardUrl,
      },
    },
  });

  // TODO: Send email notification
  console.log(`[notifyContributionPublished] Would send email to ${contribution.user.email}:`, {
    articleTitle: contribution.articleTopic.title,
    articleUrl,
  });
}

/**
 * Notify a user that they earned a new badge
 */
export async function notifyBadgeEarned(
  userId: string,
  badgeLevel: string
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true },
  });

  if (!user) {
    console.warn(`[notifyBadgeEarned] User not found: ${userId}`);
    return;
  }

  const badgeLabels: Record<string, string> = {
    VOICE: 'Voice',
    PERSPECTIVE: 'Design Perspective',
    SPECIALIST: 'Product Specialist',
    ENGAGED: 'Engaged Reader',
    AUTHORITY: 'Industry Authority',
    EDITORIAL_VOICE: 'Editorial Voice',
  };

  const badgeLabel = badgeLabels[badgeLevel] || badgeLevel;

  // Create in-app notification
  await prisma.notification.create({
    data: {
      userId,
      type: 'BADGE_EARNED',
      title: 'New badge earned!',
      body: `You've earned the ${badgeLabel} badge for your contributions.`,
      actionUrl: '/contributor/profile',
      metadata: {
        badgeLevel,
      },
    },
  });

  // TODO: Send email notification
  console.log(`[notifyBadgeEarned] Would send email to ${user.email}:`, {
    badgeLevel,
    badgeLabel,
  });
}

/**
 * Notify users about a new article topic they might be interested in
 */
export async function notifyNewTopicMatchingUsers(
  articleTopicId: string
): Promise<{ notified: number }> {
  const topic = await prisma.articleTopic.findUnique({
    where: { id: articleTopicId },
    select: {
      id: true,
      title: true,
      slug: true,
      promptQuestion: true,
      targetRoles: true,
      targetMaterials: true,
      targetStyles: true,
    },
  });

  if (!topic) {
    console.warn(`[notifyNewTopicMatchingUsers] Topic not found: ${articleTopicId}`);
    return { notified: 0 };
  }

  // Find users matching target roles (if specified)
  const whereClause: any = {
    accountStatus: 'APPROVED',
  };

  if (topic.targetRoles.length > 0) {
    whereClause.role = { in: topic.targetRoles };
  }

  // Get matching users (limit to prevent spam)
  const users = await prisma.user.findMany({
    where: whereClause,
    select: { id: true, email: true, name: true },
    take: 100,
  });

  let notified = 0;

  for (const user of users) {
    // Create in-app notification
    await prisma.notification.create({
      data: {
        userId: user.id,
        type: 'NEW_TOPIC_AVAILABLE',
        title: 'New voices wanted',
        body: `We're gathering perspectives on "${topic.title}". Add your voice.`,
        actionUrl: `/article-topics/${topic.slug}`,
        metadata: {
          articleTopicId: topic.id,
          promptQuestion: topic.promptQuestion,
        },
      },
    });

    notified++;
  }

  console.log(`[notifyNewTopicMatchingUsers] Notified ${notified} users about topic: ${topic.title}`);
  return { notified };
}

/**
 * Notification types for the contribution system
 */
export const CONTRIBUTION_NOTIFICATION_TYPES = {
  CONTRIBUTION_PUBLISHED: 'CONTRIBUTION_PUBLISHED',
  BADGE_EARNED: 'BADGE_EARNED',
  NEW_TOPIC_AVAILABLE: 'NEW_TOPIC_AVAILABLE',
} as const;
