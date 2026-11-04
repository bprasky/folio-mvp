import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { isWorkspaceImport, WORKSPACE_IMPORT_KIND } from '@/lib/workspace-import/types';

export const dynamic = 'force-dynamic';

/** Profile is a durable return to saved work, independent of notification read state. */
export default async function DesignerProfilePage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/auth/signin?callbackUrl=%2Fdesigner%2Fprofile');
  const userId = session.user.id;
  const [user, memberships] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { operatingAsOrgId: true } }),
    prisma.organizationUser.findMany({ where: { userId, isActive: true },
      select: { organizationId: true }, orderBy: { joinedAt: 'asc' } }),
  ]);
  if (!memberships.length) redirect('/onboarding/workspace');
  const currentOrgId = memberships.find(member => member.organizationId === user.operatingAsOrgId)?.organizationId;
  const orgIds = currentOrgId ? [currentOrgId] : memberships.map(member => member.organizationId);
  const imports = await prisma.importSession.findMany({ where: { userId,
    AND: [
      { processingMeta: { path: ['kind'], equals: WORKSPACE_IMPORT_KIND } },
      { OR: orgIds.map(orgId => ({ processingMeta: { path: ['orgId'], equals: orgId } })) },
    ] }, select: { id: true, processingMeta: true }, orderBy: { createdAt: 'desc' }, take: 10 });
  const saved = imports.find(row => isWorkspaceImport(row.processingMeta) && orgIds.includes(row.processingMeta.orgId));
  if (saved && isWorkspaceImport(saved.processingMeta)) {
    // A single added project has its own review link. Keep the firm's full import in My Profile.
    if (saved.processingMeta.pages[0]?.kind === 'project') {
      const profileImport = await prisma.importSession.findFirst({ where: { userId, AND: [
        { processingMeta: { path: ['kind'], equals: WORKSPACE_IMPORT_KIND } },
        { processingMeta: { path: ['orgId'], equals: saved.processingMeta.orgId } },
        { processingMeta: { path: ['pages', '0', 'kind'], equals: 'home' } },
      ] }, orderBy: { createdAt: 'desc' }, select: { id: true } });
      if (profileImport) redirect('/onboarding/workspace?import=' + encodeURIComponent(profileImport.id));
    }
    redirect('/onboarding/workspace?import=' + encodeURIComponent(saved.id));
  }
  redirect('/org/' + encodeURIComponent(currentOrgId || memberships[0].organizationId));
}
