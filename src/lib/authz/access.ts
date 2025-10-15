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
    select: { id: true, projectId: true, vendorOrgId: true },
  });
  if (!sel) throw new Error("NotFound");

  const a = await assertProjectView(userId, sel.projectId);

  // Designers can view all; vendors only their own selections
  if (a.side === ParticipantSide.VENDOR && a.vendorOrgId !== sel.vendorOrgId) {
    throw new Error("Forbidden");
  }
  return { access: a, selection: sel };
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
