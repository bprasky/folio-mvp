import { prisma } from '@/lib/prisma';

/** A server decision. Never use request parameters or a client role for Shop. */
export async function canPreviewProjectShop(projectId: string, userId?: string | null): Promise<boolean> {
  if (!userId) return false;
  const project = await prisma.project.findUnique({
    where: { id: projectId }, select: { ownerId: true, designerId: true, designerOrgId: true },
  });
  if (!project) return false;
  if (project.ownerId === userId || project.designerId === userId) return true;
  if (!project.designerOrgId) return false;
  return Boolean(await prisma.organizationUser.findFirst({
    where: { organizationId: project.designerOrgId, userId, isActive: true, role: { in: ['OWNER', 'ADMIN'] } },
    select: { id: true },
  }));
}
