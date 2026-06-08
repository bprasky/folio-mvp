/**
 * Pending project-deletion requests that the current user is allowed to act on.
 * Scoped to orgs where the viewer holds `delete_projects` (Owner/Admin); global
 * admins see every pending request. Drives the approval queue on the dashboard.
 */

import { prisma } from '@/lib/prisma';
import { can, isOrgRole } from '@/lib/orgPermissions';

export type PendingDeletionRequest = {
  id: string;
  projectId: string;
  projectTitle: string;
  requesterName: string;
  reason: string | null;
  orgName: string | null;
  createdAt: Date;
};

export async function getPendingDeletionRequests(
  userId: string,
  userRole?: string | null,
): Promise<PendingDeletionRequest[]> {
  try {
    const isGlobalAdmin = userRole === 'ADMIN';

    // Orgs where the viewer can delete projects (and therefore approve requests).
    let orgFilter: { orgId: { in: string[] } } | undefined;
    if (!isGlobalAdmin) {
      const memberships = await prisma.organizationUser.findMany({
        where: { userId, isActive: true },
        select: { organizationId: true, role: true },
      });
      const approvableOrgIds = memberships
        .filter(m => isOrgRole(m.role) && can(m.role, 'delete_projects'))
        .map(m => m.organizationId);
      if (approvableOrgIds.length === 0) return [];
      orgFilter = { orgId: { in: approvableOrgIds } };
    }

    const requests = await prisma.projectDeletionRequest.findMany({
      where: { status: 'PENDING', ...(orgFilter ?? {}) },
      select: {
        id: true,
        projectId: true,
        reason: true,
        createdAt: true,
        project: { select: { title: true, designerOrg: { select: { name: true } } } },
        requestedBy: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    return requests.map(r => ({
      id: r.id,
      projectId: r.projectId,
      projectTitle: r.project?.title || 'Untitled Project',
      requesterName: r.requestedBy?.name || r.requestedBy?.email || 'A teammate',
      reason: r.reason,
      orgName: r.project?.designerOrg?.name ?? null,
      createdAt: r.createdAt,
    }));
  } catch (error) {
    console.error('[getPendingDeletionRequests] failed:', error);
    return [];
  }
}
