export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/my-projects
 * Returns all projects the user has access to, grouped by ownership context.
 * Also returns user's org memberships so modal can offer creating org projects.
 * Used by SaveToProjectModal to show personal and org projects.
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    // Get user's org memberships
    const memberships = await prisma.organizationUser.findMany({
      where: { userId, isActive: true },
      select: {
        organizationId: true,
        organization: {
          select: {
            id: true,
            name: true,
            type: true,
          }
        }
      },
    });

    const orgIds = memberships.map(m => m.organizationId);

    // Format orgs for the response
    const userOrgs = memberships.map(m => ({
      id: m.organization.id,
      name: m.organization.name,
      type: m.organization.type,
    }));

    // Build query filters
    const orFilters: any[] = [
      // Personal projects (user is designer/owner with no org)
      { designerId: userId, designerOrgId: null },
      { ownerId: userId, designerOrgId: null },
    ];

    // Org projects (projects belonging to user's orgs)
    if (orgIds.length > 0) {
      orFilters.push({ designerOrgId: { in: orgIds } });
    }

    // Participant projects
    try {
      const participantProjects = await prisma.projectParticipant.findMany({
        where: { userId },
        select: { projectId: true },
      });
      const participantProjectIds = participantProjects.map(p => p.projectId);
      if (participantProjectIds.length > 0) {
        orFilters.push({ id: { in: participantProjectIds } });
      }
    } catch {
      // ProjectParticipant may not exist in schema
    }

    const projects = await prisma.project.findMany({
      where: { OR: orFilters },
      select: {
        id: true,
        title: true,
        updatedAt: true,
        designerOrgId: true,
        designerOrg: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    // Transform to include ownership context
    const projectList = projects.map(project => ({
      id: project.id,
      title: project.title || 'Untitled Project',
      updatedAt: project.updatedAt.toISOString(),
      ownershipContext: project.designerOrgId ? 'organization' : 'personal',
      organizationId: project.designerOrgId,
      organizationName: project.designerOrg?.name || null,
    }));

    return NextResponse.json({
      projects: projectList,
      userOrgs: userOrgs,
    });
  } catch (error) {
    console.error('[my-projects] Error fetching projects:', error);
    return NextResponse.json(
      { error: 'Failed to fetch projects' },
      { status: 500 }
    );
  }
}
