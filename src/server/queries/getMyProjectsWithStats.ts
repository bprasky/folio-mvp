/**
 * Fetches projects for the current user with computed analytics:
 * - taggedCount: number of products tagged across all images
 * - influenceValueUsd: sum of product prices from tagged products
 * - savesByOthers: uses the saves field from Project
 */

import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';

export type ProjectWithStats = {
  id: string;
  title: string;
  description: string | null;
  stage: string;
  status: string;
  isPublic: boolean;
  publishedAt: Date | null;
  saves: number;
  views: number;
  createdAt: Date;
  updatedAt: Date;
  coverUrl: string | null;
  taggedCount: number;
  influenceValueUsd: number;
  savesByOthers: number;
  phase?: string; // Optional, will be computed client-side
  isEditorialCandidate?: boolean; // Optional, will be computed client-side
  // Ownership context
  ownershipContext: 'personal' | 'organization';
  organizationId?: string | null;
  organizationName?: string | null;
};

export async function getMyProjectsWithStats() {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    throw new Error('Unauthorized: No session found');
  }

  const userId = session.user.id;

  // Build OR filters to check all ownership paths
  const orFilters: any[] = [
    { designerId: userId },
    { ownerId: userId },
  ];

  // Organization ownership (if user belongs to an org)
  try {
    const userOrgs = await prisma.organizationUser.findMany({
      where: { userId, isActive: true },
      select: { organizationId: true },
    });

    if (userOrgs.length > 0) {
      const orgIds = userOrgs.map(ou => ou.organizationId);
      orFilters.push({ designerOrgId: { in: orgIds } });
    }
  } catch (error) {
    console.warn('[getMyProjectsWithStats] Org query failed:', error);
  }

  // Participant membership - fetch separately to avoid query complexity
  let participantProjectIds: string[] = [];
  try {
    const participantProjects = await prisma.projectParticipant.findMany({
      where: { userId },
      select: { projectId: true },
    });
    participantProjectIds = participantProjects.map(p => p.projectId);
    if (participantProjectIds.length > 0) {
      orFilters.push({ id: { in: participantProjectIds } });
    }
  } catch (error) {
    console.warn('[getMyProjectsWithStats] Participant query failed:', error);
  }

  // Fetch projects first (with org info for ownership context)
  const projects = await prisma.project.findMany({
    where: {
      OR: orFilters.length > 0 ? orFilters : [{ ownerId: userId }]
    },
    select: {
      id: true,
      title: true,
      description: true,
      stage: true,
      status: true,
      isPublic: true,
      publishedAt: true,
      saves: true,
      views: true,
      createdAt: true,
      updatedAt: true,
      designerId: true,
      ownerId: true,
      designerOrgId: true,
      designerOrg: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: [{ updatedAt: 'desc' }],
  });

  if (projects.length === 0) {
    return [];
  }

  const projectIds = projects.map(p => p.id);

  // Fetch images for these projects (including cover image)
  const images = await prisma.projectImage.findMany({
    where: {
      projectId: { in: projectIds }
    },
    select: {
      id: true,
      url: true,
      projectId: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  // Create imageId -> projectId mapping
  const imageToProjectMap = new Map<string, string>();
  images.forEach(img => {
    imageToProjectMap.set(img.id, img.projectId);
  });

  // Fetch all tags for these images with product prices
  const imageIds = images.map(img => img.id);
  const tags = imageIds.length > 0 ? await prisma.productTag.findMany({
    where: {
      imageId: { in: imageIds }
    },
    select: {
      id: true,
      imageId: true,
      product: {
        select: {
          price: true,
        }
      },
    },
  }) : [];

  // Group data by project
  type ImageType = { id: string; url: string; projectId: string; createdAt: Date };
  type TagType = { id: string; imageId: string; product: { price: number | null } | null };
  
  const imagesByProject = new Map<string, ImageType[]>();
  images.forEach(img => {
    if (!imagesByProject.has(img.projectId)) {
      imagesByProject.set(img.projectId, []);
    }
    imagesByProject.get(img.projectId)!.push(img);
  });

  const tagsByProject = new Map<string, TagType[]>();
  tags.forEach(tag => {
    const projectId = imageToProjectMap.get(tag.imageId);
    if (projectId) {
      if (!tagsByProject.has(projectId)) {
        tagsByProject.set(projectId, []);
      }
      tagsByProject.get(projectId)!.push(tag);
    }
  });

  // Transform and compute stats
  const projectsWithStats: ProjectWithStats[] = projects.map(project => {
    const projectImages = imagesByProject.get(project.id) || [];
    const projectTags = tagsByProject.get(project.id) || [];

    // Count tagged products
    const taggedCount = projectTags.length;

    // Calculate influence value (sum of product prices)
    const influenceValueUsd = projectTags.reduce((sum, tag) => {
      const price = tag.product?.price;
      if (price && typeof price === 'number') {
        return sum + price;
      }
      return sum;
    }, 0);

    // Get cover image URL (first image, if any)
    const coverImage = projectImages[0];
    const coverUrl = coverImage?.url || null;

    // Determine ownership context
    const ownershipContext: 'personal' | 'organization' = project.designerOrgId ? 'organization' : 'personal';

    return {
      id: project.id,
      title: project.title || 'Untitled Project',
      description: project.description,
      stage: project.stage,
      status: project.status,
      isPublic: project.isPublic,
      publishedAt: project.publishedAt,
      saves: project.saves,
      views: project.views,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      coverUrl,
      taggedCount,
      influenceValueUsd,
      savesByOthers: project.saves, // Using saves field as savesByOthers
      ownershipContext,
      organizationId: project.designerOrgId,
      organizationName: project.designerOrg?.name || null,
    };
  });

  return projectsWithStats;
}

