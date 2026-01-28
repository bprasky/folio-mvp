/**
 * Contribution Submission
 * Handles creating and validating contributions
 */

import { prisma } from '@/lib/prisma';
import type {
  SubmitContributionInput,
  SubmitContributionResult,
  ContributionWithRelations,
} from './types';
import { checkAndAwardBadges } from './badges';

/**
 * Submit a new contribution for an article topic
 */
export async function submitContribution(
  input: SubmitContributionInput
): Promise<SubmitContributionResult> {
  const {
    userId,
    articleTopicId,
    content,
    type,
    audioUrl,
    voiceTranscript,
    productId,
    projectId,
    saveId,
  } = input;

  // Validate content length
  if (!content || content.trim().length === 0) {
    return { success: false, error: 'Content is required' };
  }

  if (content.length > 2000) {
    return { success: false, error: 'Content exceeds maximum length of 2000 characters' };
  }

  // Get user with role
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
      name: true,
      profileImage: true,
      contributionCount: true,
    },
  });

  if (!user) {
    return { success: false, error: 'User not found' };
  }

  // Get article topic
  const topic = await prisma.articleTopic.findUnique({
    where: { id: articleTopicId },
    select: {
      id: true,
      title: true,
      slug: true,
      promptQuestion: true,
      status: true,
      targetRoles: true,
      minContributions: true,
      _count: {
        select: { contributions: true },
      },
    },
  });

  if (!topic) {
    return { success: false, error: 'Article topic not found' };
  }

  // Validate topic is in GATHERING status
  if (topic.status !== 'GATHERING') {
    return { success: false, error: 'This topic is not currently accepting contributions' };
  }

  // Validate user role matches target roles (if specified)
  if (topic.targetRoles.length > 0 && !topic.targetRoles.includes(user.role)) {
    return { success: false, error: 'Your role is not eligible for this topic' };
  }

  // Check if user already contributed
  const existingContribution = await prisma.contribution.findUnique({
    where: {
      userId_articleTopicId: { userId, articleTopicId },
    },
  });

  if (existingContribution) {
    return { success: false, error: 'You have already contributed to this topic' };
  }

  // Validate optional relations
  if (productId) {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true },
    });
    if (!product) {
      return { success: false, error: 'Product not found' };
    }
  }

  if (projectId) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    });
    if (!project) {
      return { success: false, error: 'Project not found' };
    }
  }

  // Create the contribution
  const contribution = await prisma.contribution.create({
    data: {
      userId,
      userRole: user.role,
      articleTopicId,
      type,
      content: content.trim(),
      audioUrl,
      voiceTranscript,
      productId,
      projectId,
      saveId,
      status: 'PENDING',
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          profileImage: true,
          role: true,
        },
      },
      articleTopic: {
        select: {
          id: true,
          title: true,
          slug: true,
          promptQuestion: true,
        },
      },
      product: {
        select: {
          id: true,
          name: true,
          imageUrl: true,
        },
      },
      project: {
        select: {
          id: true,
          title: true,
        },
      },
    },
  });

  // Update user contribution count
  await prisma.user.update({
    where: { id: userId },
    data: {
      contributionCount: { increment: 1 },
    },
  });

  // Check if threshold is met
  const newCount = topic._count.contributions + 1;
  let thresholdMet = false;

  if (newCount >= topic.minContributions && topic.status === 'GATHERING') {
    await prisma.articleTopic.update({
      where: { id: articleTopicId },
      data: { status: 'THRESHOLD_MET' },
    });
    thresholdMet = true;
  }

  // Check and award badges (non-blocking)
  checkAndAwardBadges(userId).catch(console.error);

  return {
    success: true,
    contribution: contribution as ContributionWithRelations,
    thresholdMet,
  };
}

/**
 * Get a user's contribution for a specific topic
 */
export async function getUserContribution(
  userId: string,
  articleTopicId: string
): Promise<ContributionWithRelations | null> {
  const contribution = await prisma.contribution.findUnique({
    where: {
      userId_articleTopicId: { userId, articleTopicId },
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          profileImage: true,
          role: true,
        },
      },
      articleTopic: {
        select: {
          id: true,
          title: true,
          slug: true,
          promptQuestion: true,
        },
      },
      product: {
        select: {
          id: true,
          name: true,
          imageUrl: true,
        },
      },
      project: {
        select: {
          id: true,
          title: true,
        },
      },
    },
  });

  return contribution as ContributionWithRelations | null;
}

/**
 * Get all contributions for a user
 */
export async function getUserContributions(
  userId: string,
  options?: {
    status?: string;
    limit?: number;
    offset?: number;
  }
): Promise<ContributionWithRelations[]> {
  const contributions = await prisma.contribution.findMany({
    where: {
      userId,
      ...(options?.status && { status: options.status as any }),
    },
    orderBy: { createdAt: 'desc' },
    take: options?.limit || 50,
    skip: options?.offset || 0,
    include: {
      user: {
        select: {
          id: true,
          name: true,
          profileImage: true,
          role: true,
        },
      },
      articleTopic: {
        select: {
          id: true,
          title: true,
          slug: true,
          promptQuestion: true,
        },
      },
      product: {
        select: {
          id: true,
          name: true,
          imageUrl: true,
        },
      },
      project: {
        select: {
          id: true,
          title: true,
        },
      },
    },
  });

  return contributions as ContributionWithRelations[];
}

/**
 * Update contribution status (admin only)
 */
export async function updateContributionStatus(
  contributionId: string,
  status: 'PENDING' | 'APPROVED' | 'SELECTED' | 'PUBLISHED' | 'REJECTED',
  options?: {
    editedContent?: string;
    pullQuote?: string;
  }
): Promise<ContributionWithRelations | null> {
  const contribution = await prisma.contribution.update({
    where: { id: contributionId },
    data: {
      status,
      ...(options?.editedContent && { editedContent: options.editedContent }),
      ...(options?.pullQuote && { pullQuote: options.pullQuote }),
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          profileImage: true,
          role: true,
        },
      },
      articleTopic: {
        select: {
          id: true,
          title: true,
          slug: true,
          promptQuestion: true,
        },
      },
      product: {
        select: {
          id: true,
          name: true,
          imageUrl: true,
        },
      },
      project: {
        select: {
          id: true,
          title: true,
        },
      },
    },
  });

  // If marked as PUBLISHED, update user's published count
  if (status === 'PUBLISHED') {
    await prisma.user.update({
      where: { id: contribution.userId },
      data: {
        publishedContributionCount: { increment: 1 },
      },
    });

    // Check for badges
    checkAndAwardBadges(contribution.userId).catch(console.error);
  }

  return contribution as ContributionWithRelations;
}
