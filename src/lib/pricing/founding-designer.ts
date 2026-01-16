/**
 * Founding Designer Program
 *
 * Manages the initial 5-20 founding designers who receive:
 * - Lifetime Pro access, free
 * - Grandfathered regardless of future pricing changes
 *
 * In exchange, founding designers commit to:
 * - Publish 1-2 projects/month
 * - Share to Instagram
 * - Provide feedback
 *
 * Founding designers become case studies and proof points for public launch.
 */

import { prisma } from '@/lib/prisma';
import type { FoundingDesignerInfo } from './types';

// Program configuration
export const FOUNDING_DESIGNER_CONFIG = {
  maxFounders: 20,
  minFounders: 5,
  monthlyPublishingRequirement: 1, // minimum projects per month
  maxPublishingRequirement: 2, // ideal projects per month
  benefits: [
    'Lifetime Pro access, free',
    'Grandfathered pricing regardless of future changes',
    'Early access to new features',
    'Direct feedback channel to product team',
    'Featured in case studies and marketing',
    'Founding Designer badge on profile',
  ],
  commitments: [
    'Publish 1-2 projects per month',
    'Share projects to Instagram with Folio attribution',
    'Provide monthly feedback on product experience',
    'Participate in occasional user interviews',
  ],
};

/**
 * Check if user is a founding designer
 */
export async function isFoundingDesigner(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      subscriptionTier: true,
      subscriptionExpiresAt: true,
    },
  });

  if (!user) return false;

  // Founding designers have Pro tier with null expiry (lifetime)
  return user.subscriptionTier === 'PRO' && user.subscriptionExpiresAt === null;
}

/**
 * Get founding designer info for a user
 */
export async function getFoundingDesignerInfo(userId: string): Promise<FoundingDesignerInfo> {
  const isFounder = await isFoundingDesigner(userId);

  if (!isFounder) {
    return {
      isFoundingDesigner: false,
      enrolledAt: null,
      publishingCommitment: {
        required: 0,
        fulfilled: 0,
        lastPublishedAt: null,
      },
      benefits: [],
    };
  }

  // Get user's account creation date (enrollment date for founding designers)
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { createdAt: true },
  });

  // Count projects published this month
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const publishedThisMonth = await prisma.project.count({
    where: {
      designerId: userId,
      isPublic: true,
      publishedAt: { gte: monthStart },
    },
  });

  // Get most recent published project
  const lastPublished = await prisma.project.findFirst({
    where: {
      designerId: userId,
      isPublic: true,
      publishedAt: { not: null },
    },
    orderBy: { publishedAt: 'desc' },
    select: { publishedAt: true },
  });

  return {
    isFoundingDesigner: true,
    enrolledAt: user?.createdAt ?? null,
    publishingCommitment: {
      required: FOUNDING_DESIGNER_CONFIG.monthlyPublishingRequirement,
      fulfilled: publishedThisMonth,
      lastPublishedAt: lastPublished?.publishedAt ?? null,
    },
    benefits: FOUNDING_DESIGNER_CONFIG.benefits,
  };
}

/**
 * Check current founding designer capacity
 */
export async function getFoundingDesignerCapacity(): Promise<{
  current: number;
  max: number;
  remaining: number;
  isFull: boolean;
}> {
  // Count users with Pro tier and null expiry (lifetime = founding designer)
  const currentFounders = await prisma.user.count({
    where: {
      subscriptionTier: 'PRO',
      subscriptionExpiresAt: null,
      role: { in: ['DESIGNER', 'ARCHITECT', 'BUILDER'] },
    },
  });

  return {
    current: currentFounders,
    max: FOUNDING_DESIGNER_CONFIG.maxFounders,
    remaining: Math.max(0, FOUNDING_DESIGNER_CONFIG.maxFounders - currentFounders),
    isFull: currentFounders >= FOUNDING_DESIGNER_CONFIG.maxFounders,
  };
}

/**
 * Check if user is eligible for founding designer program
 */
export async function isEligibleForFoundingProgram(userId: string): Promise<{
  eligible: boolean;
  reason?: string;
}> {
  // Check capacity
  const capacity = await getFoundingDesignerCapacity();
  if (capacity.isFull) {
    return {
      eligible: false,
      reason: 'The Founding Designer Program has reached capacity.',
    };
  }

  // Check if already a founding designer
  const isFounder = await isFoundingDesigner(userId);
  if (isFounder) {
    return {
      eligible: false,
      reason: 'You are already a Founding Designer.',
    };
  }

  // Check if user is a professional role
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });

  if (!user) {
    return {
      eligible: false,
      reason: 'User not found.',
    };
  }

  const professionalRoles = ['DESIGNER', 'ARCHITECT', 'BUILDER'];
  if (!professionalRoles.includes(user.role)) {
    return {
      eligible: false,
      reason: 'The Founding Designer Program is only available to design professionals.',
    };
  }

  return { eligible: true };
}

/**
 * Enroll user as a founding designer
 * This grants lifetime Pro access with null expiry date
 */
export async function enrollFoundingDesigner(userId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  const eligibility = await isEligibleForFoundingProgram(userId);
  if (!eligibility.eligible) {
    return {
      success: false,
      error: eligibility.reason,
    };
  }

  // Update user to Pro tier with null expiry (lifetime)
  await prisma.user.update({
    where: { id: userId },
    data: {
      subscriptionTier: 'PRO',
      subscriptionExpiresAt: null, // null = lifetime access
    },
  });

  return { success: true };
}

/**
 * Check founding designer publishing compliance
 * Returns designers who haven't met their monthly commitment
 */
export async function checkFoundingDesignerCompliance(): Promise<
  Array<{
    userId: string;
    name: string;
    email: string;
    projectsThisMonth: number;
    lastPublishedAt: Date | null;
    monthsNonCompliant: number;
  }>
> {
  // Get all founding designers
  const founders = await prisma.user.findMany({
    where: {
      subscriptionTier: 'PRO',
      subscriptionExpiresAt: null,
      role: { in: ['DESIGNER', 'ARCHITECT', 'BUILDER'] },
    },
    select: {
      id: true,
      name: true,
      email: true,
      designerProjects: {
        where: {
          isPublic: true,
          publishedAt: { not: null },
        },
        orderBy: { publishedAt: 'desc' },
        select: { publishedAt: true },
      },
    },
  });

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const nonCompliantFounders = [];

  for (const founder of founders) {
    // Count projects this month
    const projectsThisMonth = founder.designerProjects.filter(
      (p) => p.publishedAt && new Date(p.publishedAt) >= monthStart
    ).length;

    // Get last published date
    const lastPublished = founder.designerProjects[0]?.publishedAt ?? null;

    // Check if non-compliant
    if (projectsThisMonth < FOUNDING_DESIGNER_CONFIG.monthlyPublishingRequirement) {
      // Calculate months of non-compliance
      let monthsNonCompliant = 0;
      if (lastPublished) {
        const monthsSinceLastPublish =
          (monthStart.getTime() - new Date(lastPublished).getTime()) /
          (1000 * 60 * 60 * 24 * 30);
        monthsNonCompliant = Math.floor(monthsSinceLastPublish);
      }

      nonCompliantFounders.push({
        userId: founder.id,
        name: founder.name,
        email: founder.email,
        projectsThisMonth,
        lastPublishedAt: lastPublished,
        monthsNonCompliant,
      });
    }
  }

  return nonCompliantFounders;
}

/**
 * Get all founding designers with their stats
 */
export async function listFoundingDesigners(): Promise<
  Array<{
    userId: string;
    name: string;
    email: string;
    enrolledAt: Date;
    totalProjectsPublished: number;
    projectsThisMonth: number;
    isCompliant: boolean;
  }>
> {
  const founders = await prisma.user.findMany({
    where: {
      subscriptionTier: 'PRO',
      subscriptionExpiresAt: null,
      role: { in: ['DESIGNER', 'ARCHITECT', 'BUILDER'] },
    },
    select: {
      id: true,
      name: true,
      email: true,
      createdAt: true,
      designerProjects: {
        where: {
          isPublic: true,
          publishedAt: { not: null },
        },
        select: { publishedAt: true },
      },
    },
  });

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  return founders.map((founder) => {
    const projectsThisMonth = founder.designerProjects.filter(
      (p) => p.publishedAt && new Date(p.publishedAt) >= monthStart
    ).length;

    return {
      userId: founder.id,
      name: founder.name,
      email: founder.email,
      enrolledAt: founder.createdAt,
      totalProjectsPublished: founder.designerProjects.length,
      projectsThisMonth,
      isCompliant: projectsThisMonth >= FOUNDING_DESIGNER_CONFIG.monthlyPublishingRequirement,
    };
  });
}
