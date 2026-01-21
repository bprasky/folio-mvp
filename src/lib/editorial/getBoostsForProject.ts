/**
 * Editorial Integration for Boosted Testimonials
 *
 * Retrieves boosted testimonials for display in project editorials
 * and on vendor profile pages.
 */

import { prisma } from '@/lib/prisma';
import type { Boost, BoostOpportunity, User, Organization, Project } from '@prisma/client';

export interface BoostWithContext extends Boost {
  opportunity: BoostOpportunity & {
    designer: Pick<User, 'id' | 'name' | 'profileImage'>;
    vendor: Pick<Organization, 'id' | 'name'> & { slug?: string };
    project: Pick<Project, 'id' | 'title'> & { slug?: string };
  };
}

/**
 * Get boosted testimonials for a project (for editorial display)
 */
export async function getBoostsForProject(projectId: string): Promise<BoostWithContext[]> {
  const boosts = await prisma.boost.findMany({
    where: {
      opportunity: { projectId },
      showInArticle: true,
      // Optional: filter by displayUntil if set
      OR: [
        { displayUntil: null },
        { displayUntil: { gt: new Date() } },
      ],
    },
    include: {
      opportunity: {
        include: {
          designer: {
            select: {
              id: true,
              name: true,
              profileImage: true,
            },
          },
          vendor: {
            select: {
              id: true,
              name: true,
            },
          },
          project: {
            select: {
              id: true,
              title: true,
            },
          },
        },
      },
    },
    orderBy: { priority: 'desc' },
  });

  return boosts as BoostWithContext[];
}

/**
 * Get boosted testimonials for a vendor's profile page
 */
export async function getBoostsForVendor(
  vendorId: string,
  options?: {
    limit?: number;
    includeExpired?: boolean;
  }
): Promise<BoostWithContext[]> {
  const { limit = 10, includeExpired = false } = options || {};

  const whereClause: any = {
    vendorId,
    showOnVendorPage: true,
  };

  if (!includeExpired) {
    whereClause.OR = [
      { displayUntil: null },
      { displayUntil: { gt: new Date() } },
    ];
  }

  const boosts = await prisma.boost.findMany({
    where: whereClause,
    include: {
      opportunity: {
        include: {
          designer: {
            select: {
              id: true,
              name: true,
              profileImage: true,
            },
          },
          vendor: {
            select: {
              id: true,
              name: true,
            },
          },
          project: {
            select: {
              id: true,
              title: true,
            },
          },
        },
      },
    },
    orderBy: [
      { priority: 'desc' },
      { createdAt: 'desc' },
    ],
    take: limit,
  });

  return boosts as BoostWithContext[];
}

/**
 * Get a single boost by ID
 */
export async function getBoostById(boostId: string): Promise<BoostWithContext | null> {
  const boost = await prisma.boost.findUnique({
    where: { id: boostId },
    include: {
      opportunity: {
        include: {
          designer: {
            select: {
              id: true,
              name: true,
              profileImage: true,
            },
          },
          vendor: {
            select: {
              id: true,
              name: true,
            },
          },
          project: {
            select: {
              id: true,
              title: true,
            },
          },
        },
      },
    },
  });

  return boost as BoostWithContext | null;
}

/**
 * Increment impression count for a boost (when displayed)
 */
export async function recordBoostImpression(boostId: string): Promise<void> {
  await prisma.boost.update({
    where: { id: boostId },
    data: {
      impressions: { increment: 1 },
    },
  });
}

/**
 * Increment click count for a boost (when clicked)
 */
export async function recordBoostClick(boostId: string): Promise<void> {
  await prisma.boost.update({
    where: { id: boostId },
    data: {
      clicks: { increment: 1 },
    },
  });
}

/**
 * Get boost stats for a vendor
 */
export async function getVendorBoostStats(vendorId: string): Promise<{
  totalBoosts: number;
  activeBoosts: number;
  totalImpressions: number;
  totalClicks: number;
}> {
  const [totalBoosts, activeBoosts, stats] = await Promise.all([
    prisma.boost.count({
      where: { vendorId },
    }),
    prisma.boost.count({
      where: {
        vendorId,
        OR: [
          { displayUntil: null },
          { displayUntil: { gt: new Date() } },
        ],
      },
    }),
    prisma.boost.aggregate({
      where: { vendorId },
      _sum: {
        impressions: true,
        clicks: true,
      },
    }),
  ]);

  return {
    totalBoosts,
    activeBoosts,
    totalImpressions: stats._sum.impressions || 0,
    totalClicks: stats._sum.clicks || 0,
  };
}
