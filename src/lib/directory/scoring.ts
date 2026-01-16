/**
 * Directory Score Calculation Engine
 * Calculates merit-based ranking scores for designers and vendors
 */

import { prisma } from '@/lib/prisma';
import {
  DesignerScoreComponents,
  VendorScoreComponents,
  DESIGNER_SCORE_WEIGHTS,
  VENDOR_SCORE_WEIGHTS,
  RECENCY_DECAY,
  ENGAGEMENT_WEIGHTS,
  EDITORIAL_WEIGHTS,
} from './types';

/**
 * Calculate recency decay factor based on days since publish
 */
function getRecencyDecayFactor(daysSincePublish: number): number {
  if (daysSincePublish < 30) return RECENCY_DECAY.UNDER_30_DAYS;
  if (daysSincePublish < 90) return RECENCY_DECAY.UNDER_90_DAYS;
  if (daysSincePublish < 180) return RECENCY_DECAY.UNDER_180_DAYS;
  return RECENCY_DECAY.OVER_180_DAYS;
}

/**
 * Calculate project completeness score (0-100)
 */
function calculateProjectCompleteness(project: {
  description: string | null;
  rooms: { id: string; name: string | null }[];
  images: { room: string | null }[];
  selections: { vendorName: string | null }[];
}): number {
  let score = 0;

  // Has description (15%)
  if (project.description && project.description.length > 50) {
    score += 15;
  }

  // Has rooms organized (25%)
  if (project.rooms.length > 0) {
    score += 25;
  }

  // Has room descriptions/names (15%)
  const roomsWithNames = project.rooms.filter(r => r.name && r.name.length > 0);
  if (roomsWithNames.length > 0) {
    score += 15;
  }

  // Images have room assignments (20%)
  const imagesWithRooms = project.images.filter(i => i.room);
  if (project.images.length > 0) {
    const roomAssignmentRatio = imagesWithRooms.length / project.images.length;
    score += roomAssignmentRatio * 20;
  }

  // All tags have vendor attribution (25%)
  const selectionsWithVendor = project.selections.filter(s => s.vendorName);
  if (project.selections.length > 0) {
    const vendorAttributionRatio = selectionsWithVendor.length / project.selections.length;
    score += vendorAttributionRatio * 25;
  }

  return Math.min(100, score);
}

/**
 * Calculate designer score components
 */
export async function calculateDesignerScores(userId: string): Promise<DesignerScoreComponents> {
  const now = new Date();

  // Fetch all published projects with their tags, images, and engagement data
  const projects = await prisma.project.findMany({
    where: {
      designerId: userId,
      isPublic: true,
      publishedAt: { not: null },
    },
    include: {
      images: {
        include: {
          tags: {
            include: {
              product: true,
            },
          },
        },
      },
      rooms: true,
      selections: true,
    },
  });

  // Fetch user engagement stats
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      followers: true,
      following: true,
      views: true,
    },
  });

  // Fetch editorial data
  const editorialPosts = await prisma.projectPost.findMany({
    where: {
      project: {
        designerId: userId,
      },
      status: 'PUBLISHED',
    },
  });

  const editorialAssignments = await prisma.editorialAssignment.findMany({
    where: {
      project: {
        designerId: userId,
      },
    },
  });

  // 1. Tagged Projects Score (35%)
  let taggedProjectsScore = 0;
  for (const project of projects) {
    const totalImages = project.images.length;
    const totalTags = project.images.reduce((sum, img) => sum + img.tags.length, 0);

    if (totalImages > 0) {
      const tagDensity = totalTags / totalImages;
      const completenessMultiplier = calculateProjectCompleteness(project) / 100;
      taggedProjectsScore += tagDensity * completenessMultiplier * 10; // Scale factor
    }
  }
  taggedProjectsScore = Math.min(100, taggedProjectsScore);

  // 2. Completeness Score (20%)
  let completenessScore = 0;
  if (projects.length > 0) {
    const totalCompleteness = projects.reduce(
      (sum, project) => sum + calculateProjectCompleteness(project),
      0
    );
    completenessScore = totalCompleteness / projects.length;
  }

  // 3. Engagement Score (15%)
  const totalSaves = projects.reduce((sum, p) => sum + p.saves, 0);
  const totalViews = projects.reduce((sum, p) => sum + p.views, 0);
  const totalShares = projects.reduce((sum, p) => sum + p.shares, 0);
  const followerCount = user?.followers ?? 0;

  const rawEngagement =
    totalSaves * ENGAGEMENT_WEIGHTS.saves +
    totalViews * ENGAGEMENT_WEIGHTS.views +
    followerCount * ENGAGEMENT_WEIGHTS.followers +
    totalShares * ENGAGEMENT_WEIGHTS.shares;

  // Normalize engagement (log scale for fair comparison)
  const engagementScore = Math.min(100, Math.log10(rawEngagement + 1) * 20);

  // 4. Editorial Score (15%)
  const articlesAuthored = editorialPosts.length;
  const editorialProjectsAchieved = editorialAssignments.length;

  const rawEditorial =
    articlesAuthored * EDITORIAL_WEIGHTS.articlesAuthored +
    editorialProjectsAchieved * EDITORIAL_WEIGHTS.editorialProjectsAchieved;

  const editorialScore = Math.min(100, rawEditorial);

  // 5. Vendor Diversity Score (10%)
  const allVendorIds = new Set<string>();
  let totalProducts = 0;

  for (const project of projects) {
    for (const image of project.images) {
      for (const tag of image.tags) {
        totalProducts++;
        if (tag.product.vendorId) {
          allVendorIds.add(tag.product.vendorId);
        }
      }
    }
  }

  const vendorDiversityScore =
    totalProducts > 0 ? Math.min(100, (allVendorIds.size / totalProducts) * 100) : 0;

  // 6. Recency Score (5%)
  let recencyScore = 0;
  if (projects.length > 0) {
    for (const project of projects) {
      if (project.publishedAt) {
        const daysSincePublish = Math.floor(
          (now.getTime() - project.publishedAt.getTime()) / (1000 * 60 * 60 * 24)
        );
        const decay = getRecencyDecayFactor(daysSincePublish);
        recencyScore += decay * (100 / projects.length);
      }
    }
  }

  return {
    taggedProjectsScore: Math.round(taggedProjectsScore * 100) / 100,
    completenessScore: Math.round(completenessScore * 100) / 100,
    engagementScore: Math.round(engagementScore * 100) / 100,
    editorialScore: Math.round(editorialScore * 100) / 100,
    vendorDiversityScore: Math.round(vendorDiversityScore * 100) / 100,
    recencyScore: Math.round(recencyScore * 100) / 100,
  };
}

/**
 * Calculate vendor score components
 */
export async function calculateVendorScores(vendorOrgId: string): Promise<VendorScoreComponents> {
  // Get all products associated with this vendor organization
  // Note: Products are linked to users (vendor reps), not directly to orgs
  // We need to find products through organization users
  const orgUsers = await prisma.organizationUser.findMany({
    where: { organizationId: vendorOrgId },
    select: { userId: true },
  });

  const userIds = orgUsers.map(ou => ou.userId);

  // Get all products from this vendor's users
  const products = await prisma.product.findMany({
    where: {
      vendorId: { in: userIds },
    },
    include: {
      tags: {
        include: {
          image: {
            include: {
              project: {
                select: {
                  id: true,
                  designerId: true,
                  saves: true,
                  views: true,
                  isPublic: true,
                },
              },
            },
          },
        },
      },
    },
  });

  // 1. Designer Tags Score (40%)
  // Count unique designers who have tagged this vendor's products
  const designersTagging = new Set<string>();
  const projectsIncluded = new Set<string>();
  let totalSaves = 0;

  for (const product of products) {
    for (const tag of product.tags) {
      if (tag.image?.project?.designerId) {
        designersTagging.add(tag.image.project.designerId);
      }
      if (tag.image?.project?.id && tag.image.project.isPublic) {
        projectsIncluded.add(tag.image.project.id);
        totalSaves += tag.image.project.saves;
      }
    }
  }

  // Normalize designer tags (log scale)
  const designerTagsScore = Math.min(100, Math.log10(designersTagging.size + 1) * 50);

  // 2. Project Inclusion Score (25%)
  const projectInclusionScore = Math.min(100, Math.log10(projectsIncluded.size + 1) * 50);

  // 3. Save Score (20%)
  const saveScore = Math.min(100, Math.log10(totalSaves + 1) * 25);

  // 4. Catalog Completeness Score (15%)
  // Based on product data completeness
  let catalogCompleteness = 0;
  if (products.length > 0) {
    for (const product of products) {
      let productScore = 0;
      if (product.name) productScore += 20;
      if (product.description) productScore += 20;
      if (product.imageUrl) productScore += 30;
      if (product.price) productScore += 15;
      if (product.category) productScore += 15;
      catalogCompleteness += productScore;
    }
    catalogCompleteness = catalogCompleteness / products.length;
  }

  return {
    designerTagsScore: Math.round(designerTagsScore * 100) / 100,
    projectInclusionScore: Math.round(projectInclusionScore * 100) / 100,
    saveScore: Math.round(saveScore * 100) / 100,
    catalogCompletenessScore: Math.round(catalogCompleteness * 100) / 100,
  };
}

/**
 * Calculate total designer score from components
 */
export function calculateDesignerTotalScore(components: DesignerScoreComponents): number {
  const total =
    components.taggedProjectsScore * DESIGNER_SCORE_WEIGHTS.taggedProjects +
    components.completenessScore * DESIGNER_SCORE_WEIGHTS.completeness +
    components.engagementScore * DESIGNER_SCORE_WEIGHTS.engagement +
    components.editorialScore * DESIGNER_SCORE_WEIGHTS.editorial +
    components.vendorDiversityScore * DESIGNER_SCORE_WEIGHTS.vendorDiversity +
    components.recencyScore * DESIGNER_SCORE_WEIGHTS.recency;

  return Math.round(total * 100) / 100;
}

/**
 * Calculate total vendor score from components
 */
export function calculateVendorTotalScore(components: VendorScoreComponents): number {
  const total =
    components.designerTagsScore * VENDOR_SCORE_WEIGHTS.designerTags +
    components.projectInclusionScore * VENDOR_SCORE_WEIGHTS.projectInclusion +
    components.saveScore * VENDOR_SCORE_WEIGHTS.saves +
    components.catalogCompletenessScore * VENDOR_SCORE_WEIGHTS.catalogCompleteness;

  return Math.round(total * 100) / 100;
}

/**
 * Generate ranking improvement suggestions for a designer
 */
export function generateDesignerSuggestions(
  components: DesignerScoreComponents,
  isEligible: boolean
): { type: string; message: string; potentialScoreGain: number; actionUrl?: string }[] {
  const suggestions: { type: string; message: string; potentialScoreGain: number; actionUrl?: string }[] = [];

  if (!isEligible) {
    suggestions.push({
      type: 'upgrade_pro',
      message: 'Upgrade to Pro to appear in the Folio Directory and compete with the industry\'s best.',
      potentialScoreGain: 0,
      actionUrl: '/settings/subscription',
    });
  }

  if (components.taggedProjectsScore < 50) {
    suggestions.push({
      type: 'tag_products',
      message: 'Tag more products in your project images to boost your ranking.',
      potentialScoreGain: Math.round((50 - components.taggedProjectsScore) * DESIGNER_SCORE_WEIGHTS.taggedProjects),
      actionUrl: '/projects',
    });
  }

  if (components.completenessScore < 70) {
    suggestions.push({
      type: 'complete_project',
      message: 'Complete your project details (descriptions, room organization, vendor attribution).',
      potentialScoreGain: Math.round((70 - components.completenessScore) * DESIGNER_SCORE_WEIGHTS.completeness),
      actionUrl: '/projects',
    });
  }

  if (components.recencyScore < 50) {
    suggestions.push({
      type: 'publish_more',
      message: 'Publish new projects to maintain momentum and recency boost.',
      potentialScoreGain: Math.round((50 - components.recencyScore) * DESIGNER_SCORE_WEIGHTS.recency),
      actionUrl: '/projects/new',
    });
  }

  return suggestions.slice(0, 3); // Return top 3 suggestions
}
