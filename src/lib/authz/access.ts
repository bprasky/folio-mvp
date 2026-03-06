import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

const E = (Prisma as any).$Enums ?? (Prisma as any);
const ParticipantSide = E.ParticipantSide ?? {};
const ParticipantRole = E.ParticipantRole ?? {};

export async function getProjectAccess(userId: string, projectId: string) {
  // First check if user is owner or designer (direct access)
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { ownerId: true, designerId: true },
  });

  if (!project) return null;

  // Grant access if user is owner or designer
  if (project.ownerId === userId || project.designerId === userId) {
    return { role: ParticipantRole.OWNER, side: ParticipantSide.DESIGNER, vendorOrgId: null };
  }

  // Find all orgs this user belongs to
  const memberships = await prisma.organizationUser.findMany({
    where: { userId, isActive: true },
    select: { organizationId: true, organization: { select: { id: true, type: true } } },
  });
  const orgIds = memberships.map(m => m.organizationId);

  // Is user a participant directly or via org?
  // Skip orgId check to avoid schema drift issues
  const p = await prisma.projectParticipant.findFirst({
    where: {
      projectId,
      OR: [
        { userId },
        ...(orgIds.length > 0 ? [{ orgId: { in: orgIds } }] : []),
      ],
    },
    select: {
      role: true,
      side: true,
      project: { select: { id: true } },
    },
  }).catch(() => null); // Fail-soft if schema mismatch

  if (!p) return null;

  // If participant is vendor-side, return basic access
  return { role: p.role, side: p.side, vendorOrgId: null };
}

export async function assertProjectView(userId: string, projectId: string) {
  const a = await getProjectAccess(userId, projectId);
  if (!a) throw new Error("Forbidden");
  return a;
}

export async function assertSelectionView(userId: string, selectionId: string) {
  const sel = await prisma.selection.findUnique({
    where: { id: selectionId },
    select: { 
      id: true, 
      projectId: true,
      project: {
        select: {
          vendorOrgId: true
        }
      }
    },
  });
  if (!sel) throw new Error("NotFound");

  const a = await assertProjectView(userId, sel.projectId);

  // Designers can view all; vendors only their own selections
  // Get vendorOrgId from the project relation
  const selectionVendorOrgId = sel.project?.vendorOrgId || null;
  if (a.side === ParticipantSide.VENDOR && a.vendorOrgId !== selectionVendorOrgId) {
    throw new Error("Forbidden");
  }
  return { access: a, selection: { id: sel.id, projectId: sel.projectId, vendorOrgId: selectionVendorOrgId } };
}

export async function assertSelectionEdit(userId: string, selectionId: string) {
  const { access, selection } = await assertSelectionView(userId, selectionId);
  
  // Only owners and editors can edit
  if (![ParticipantRole.OWNER, ParticipantRole.EDITOR].includes(access.role)) {
    throw new Error("Forbidden: Insufficient permissions");
  }
  
  return { access, selection };
}

export async function createProjectParticipant(
  projectId: string,
  orgId: string | null,
  userId: string | null,
  side: keyof typeof ParticipantSide,
  role: keyof typeof ParticipantRole
) {
  return prisma.projectParticipant.upsert({
    where: {
      projectId_orgId_userId: {
        projectId,
        orgId: orgId || "",
        userId: userId || "",
      }
    },
    update: { role, side },
    create: {
      projectId,
      orgId,
      userId,
      side,
      role,
    },
  });
}

/**
 * Assert user has edit access to a project
 * Throws if access is denied
 */
export async function assertProjectEdit(userId: string, projectId: string) {
  const access = await getProjectAccess(userId, projectId);
  if (!access) {
    throw new Error("Forbidden: No access to project");
  }
  // Check for edit-level permissions
  if (![ParticipantRole.OWNER, ParticipantRole.EDITOR].includes(access.role)) {
    throw new Error("Forbidden: Insufficient permissions");
  }
  return access;
}

/**
 * Checks if the current user has write access to a project.
 * Write access is granted if:
 * 1. User is the project owner (ownerId) or designer (designerId)
 * 2. User is a member of the project's organization with role
 *    OWNER, ADMIN, MANAGER, or MEMBER (not VIEWER)
 * 3. User is a ProjectParticipant with role OWNER or EDITOR
 * 4. User has ADMIN role (global admin)
 *
 * Throws "Forbidden" if access denied, "NotFound" if project doesn't exist.
 */
export async function assertProjectWrite(
  userId: string,
  projectId: string
): Promise<void> {
  // 1. Fetch project
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { ownerId: true, designerId: true, designerOrgId: true },
  });

  if (!project) throw new Error("NotFound");

  // 2. Direct ownership — fast path
  if (project.ownerId === userId || project.designerId === userId) return;

  // 3. Fetch user role + org memberships in parallel
  const [user, orgMemberships] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    }),
    prisma.organizationUser.findMany({
      where: { userId, isActive: true },
      select: { organizationId: true, role: true },
    }),
  ]);

  // 4. Global admin
  if (user?.role === "ADMIN") return;

  // 5. Org membership — is user in the project's org with a write-capable role?
  if (project.designerOrgId) {
    const WRITE_ROLES = ["OWNER", "ADMIN", "MANAGER", "MEMBER"];
    const orgMatch = orgMemberships.find(
      (m) =>
        m.organizationId === project.designerOrgId &&
        WRITE_ROLES.includes(m.role)
    );
    if (orgMatch) return;
  }

  // 6. ProjectParticipant — direct user or via org
  const orgIds = orgMemberships.map((m) => m.organizationId);
  const participant = await prisma.projectParticipant
    .findFirst({
      where: {
        projectId,
        OR: [
          { userId },
          ...(orgIds.length > 0 ? [{ orgId: { in: orgIds } }] : []),
        ],
        role: { in: ["OWNER", "EDITOR"] },
      },
    })
    .catch(() => null);

  if (participant) return;

  throw new Error("Forbidden");
}
