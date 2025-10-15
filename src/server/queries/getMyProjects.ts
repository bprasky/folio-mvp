/**
 * Unified query for fetching projects owned by the current user
 * Checks all possible ownership paths: designerId, ownerId, designerOrgId, and participants
 */

import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';

export type ProjectFilter = 'all' | 'published' | 'draft';

export async function getMyProjects(filter: ProjectFilter = 'all') {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    throw new Error('Unauthorized: No session found');
  }

  const userId = session.user.id;

  // Build OR filters to check all ownership paths
  const orFilters: any[] = [];

  // Direct designer ownership
  orFilters.push({ designerId: userId });

  // Direct owner ownership
  orFilters.push({ ownerId: userId });

  // Organization ownership (if user belongs to an org)
  // Note: This requires querying user's org memberships first
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
    // Fail-soft if organization query fails
    console.warn('[getMyProjects] Org query failed:', error);
  }

  // Participant membership (where user is explicitly added to project)
  orFilters.push({
    participants: {
      some: { userId }
    }
  });

  // Build where clause with ownership + optional status filter
  const whereClause: any = {
    OR: orFilters.length > 0 ? orFilters : [{ ownerId: userId }] // Fallback
  };

  // Apply status filter
  if (filter === 'published') {
    // Only show completed/published projects (for portfolio/profile view)
    whereClause.AND = [
      {
        OR: [
          { isPublic: true },
          { publishedAt: { not: null } },
          { status: 'published' }
        ]
      }
    ];
  } else if (filter === 'draft') {
    // Only show draft/in-progress projects
    whereClause.AND = [
      {
        isPublic: false,
        publishedAt: null
      }
    ];
  }

  // Execute query with all ownership paths and optional filter
  const projects = await prisma.project.findMany({
    where: whereClause,
    orderBy: [{ updatedAt: 'desc' }],
    select: {
      id: true,
      title: true,
      slug: true,
      description: true,
      category: true,
      isPublic: true,
      publishedAt: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      designerId: true,
      ownerId: true,
      images: {
        take: 1,
        select: {
          url: true,
        },
      },
    },
  });

  // Debug logging (only in development)
  if (process.env.NODE_ENV === 'development') {
    console.log('[getMyProjects]', {
      userId,
      filter,
      orFilterCount: orFilters.length,
      projectsFound: projects.length,
      projectIds: projects.map(p => p.id),
      publishedCount: projects.filter(p => p.isPublic || p.publishedAt).length,
      draftCount: projects.filter(p => !p.isPublic && !p.publishedAt).length,
    });
  }

  return projects;
}

/**
 * Get projects for a specific designer (public profile view)
 */
export async function getDesignerProjects(designerId: string) {
  return prisma.project.findMany({
    where: {
      designerId,
      // Only return published projects for public profile view
      isPublic: true,
    },
    orderBy: [{ publishedAt: 'desc' }, { updatedAt: 'desc' }],
    select: {
      id: true,
      title: true,
      slug: true,
      description: true,
      category: true,
      isPublic: true,
      publishedAt: true,
      createdAt: true,
      updatedAt: true,
      images: {
        take: 1,
        select: {
          url: true,
        },
      },
    },
  });
}

