/**
 * Fetches projects for the current user with computed analytics:
 * - taggedCount: number of products tagged across all images
 * - influenceValueUsd: sum of product prices from tagged products
 * - savesByOthers: uses the saves field from Project
 */

import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { can, isOrgRole } from '@/lib/orgPermissions';

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
  completedYear: number | null;
  completedMonth: number | null;
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
  // Whether the current viewer may delete this project outright. When false, the
  // UI offers "Request deletion" instead (org Owner/Admin must approve).
  canDelete: boolean;
};

export async function getMyProjectsWithStats(operatingAsOrgId?: string | null): Promise<ProjectWithStats[]> {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      console.error('[getMyProjectsWithStats] No session found');
      return []; // Return empty array instead of throwing to prevent page crash
    }

    const userId = session.user.id;
    console.log('[getMyProjectsWithStats] Fetching projects for user:', userId, 'operatingAsOrgId:', operatingAsOrgId);

    // Build OR filters based on operating context
    const orFilters: any[] = [];

    try {
      if (operatingAsOrgId) {
        // Operating as an organization: only show projects for that specific org
        // Verify user belongs to this org before querying
        const membership = await prisma.organizationUser.findFirst({
          where: { userId, organizationId: operatingAsOrgId, isActive: true },
        });

        if (!membership) {
          console.warn('[getMyProjectsWithStats] User not member of operating org:', operatingAsOrgId);
          return [];
        }

        // Only return projects owned by this organization
        orFilters.push({ designerOrgId: operatingAsOrgId });
      } else {
        // Operating as individual: show personal projects only
        // (projects where user is designer/owner but NOT org-owned)
        orFilters.push(
          { designerId: userId, designerOrgId: null },
          { ownerId: userId, designerOrgId: null },
        );

        // Also include projects where user is a participant (regardless of org)
        try {
          const participantProjects = await prisma.projectParticipant.findMany({
            where: { userId },
            select: { projectId: true },
          });
          const participantProjectIds = participantProjects.map(p => p.projectId);
          if (participantProjectIds.length > 0) {
            orFilters.push({ id: { in: participantProjectIds } });
          }
        } catch (error) {
          console.warn('[getMyProjectsWithStats] Participant query failed:', error);
        }
      }
    } catch (error) {
      console.error('[getMyProjectsWithStats] Error building filters:', error);
      // Fall back to basic ownership query
      orFilters.push({ ownerId: userId });
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
        completedYear: true,
        completedMonth: true,
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

    let projectIds = projects.map(p => p.id);

    // Deletion capability + "hide my pending requests" context.
    // Mirrors assertProjectCapability(delete_projects): global admin, non-org
    // owner/designer, org role with the capability, or a project-level OWNER grant.
    let visibleProjects = projects;
    let canDeleteByProject = new Map<string, boolean>();
    try {
      const viewer = await prisma.user.findUnique({
        where: { id: userId },
        select: { role: true },
      });
      const isGlobalAdmin = viewer?.role === 'ADMIN';

      const memberships = await prisma.organizationUser.findMany({
        where: { userId, isActive: true },
        select: { organizationId: true, role: true },
      });
      const roleByOrg = new Map(memberships.map(m => [m.organizationId, m.role as string]));

      const ownerGrants = await prisma.projectParticipant.findMany({
        where: { userId, role: 'OWNER', projectId: { in: projectIds } },
        select: { projectId: true },
      }).catch(() => [] as { projectId: string }[]);
      const ownerGrantIds = new Set(ownerGrants.map(g => g.projectId));

      for (const p of projects) {
        let allowed: boolean;
        if (isGlobalAdmin) {
          allowed = true;
        } else if (!p.designerOrgId) {
          allowed = p.ownerId === userId || p.designerId === userId;
        } else {
          const role = roleByOrg.get(p.designerOrgId);
          allowed = (isOrgRole(role) && can(role, 'delete_projects')) || ownerGrantIds.has(p.id);
        }
        canDeleteByProject.set(p.id, allowed);
      }

      // Hide projects this viewer has already requested deletion for ("hide for you").
      const myPending = await prisma.projectDeletionRequest.findMany({
        where: { requestedById: userId, status: 'PENDING', projectId: { in: projectIds } },
        select: { projectId: true },
      });
      const myPendingIds = new Set(myPending.map(r => r.projectId));
      if (myPendingIds.size > 0) {
        visibleProjects = projects.filter(p => !myPendingIds.has(p.id));
        projectIds = visibleProjects.map(p => p.id);
      }
    } catch (error) {
      console.warn('[getMyProjectsWithStats] Deletion-context computation failed:', error);
      // Fail-soft: default to no direct delete (UI offers request flow).
      for (const p of projects) canDeleteByProject.set(p.id, false);
    }

    if (visibleProjects.length === 0) {
      return [];
    }

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
    const projectsWithStats: ProjectWithStats[] = visibleProjects.map(project => {
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
        completedYear: project.completedYear,
        completedMonth: project.completedMonth,
        coverUrl,
        taggedCount,
        influenceValueUsd,
        savesByOthers: project.saves, // Using saves field as savesByOthers
        ownershipContext,
        organizationId: project.designerOrgId,
        organizationName: project.designerOrg?.name || null,
        canDelete: canDeleteByProject.get(project.id) ?? false,
      };
    });

    return projectsWithStats;
  } catch (error) {
    console.error('[getMyProjectsWithStats] Unhandled error:', error);
    return []; // Return empty array to prevent page crash
  }
}
