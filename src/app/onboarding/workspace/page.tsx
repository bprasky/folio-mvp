import Link from 'next/link';
import { redirect, notFound } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { professionalSetupHref, safeProfessionalCallback, firmWorkspaceDestination } from '@/lib/onboarding/professional-entry';
import { importAccess, ownedImport, WorkspaceImportError } from '@/lib/workspace-import/store';
import { isWorkspaceImport, WORKSPACE_IMPORT_KIND } from '@/lib/workspace-import/types';
import { SetupProgress } from '@/components/onboarding/SetupProgress';
import { ProfessionalSetupFrame } from '@/components/onboarding/ProfessionalSetupFrame';
import { WorkspaceImportClient } from './WorkspaceImportClient';
import '../../auth/_components/auth.css';

export const dynamic = 'force-dynamic';

export default async function WorkspacePage({ searchParams }: { searchParams: { orgId?: string; import?: string; returnTo?: string; new?: string } }) {
  const params = new URLSearchParams();
  for (const key of ['orgId', 'import', 'returnTo', 'new'] as const) if (searchParams[key]) params.set(key, searchParams[key]!);
  const here = '/onboarding/workspace' + (params.size ? '?' + params : '');
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect('/auth/signin?callbackUrl=' + encodeURIComponent(here));
  const memberships = await prisma.organizationUser.findMany({ where: { userId: session.user.id, isActive: true },
    select: { organization: { select: { id: true, name: true } } }, orderBy: { joinedAt: 'asc' } });
  let orgId = searchParams.orgId;
  let returnTo = safeProfessionalCallback(searchParams.returnTo || '/projects/new');
  if (returnTo.startsWith('/onboarding/workspace')) returnTo = '/projects/new';
  if (searchParams.import) {
    try { const { run } = await ownedImport(session.user.id, searchParams.import); orgId = run.orgId; returnTo = run.returnTo; }
    catch (error) { if (error instanceof WorkspaceImportError) notFound(); throw error; }
  }
  const user = await prisma.user.findUniqueOrThrow({ where: { id: session.user.id }, select: { operatingAsOrgId: true } });
  orgId ||= memberships.find(member => member.organization.id === user.operatingAsOrgId)?.organization.id || memberships[0]?.organization.id;
  if (!orgId || !memberships.some(member => member.organization.id === orgId)) {
    const pending = await prisma.orgJoinRequest.findFirst({ where: { userId: session.user.id, status: 'PENDING', ...(orgId ? { organizationId: orgId } : {}) },
      select: { organization: { select: { name: true } } }, orderBy: { createdAt: 'desc' } });
    if (pending) return <ProfessionalSetupFrame stage="business"><SetupProgress step={2} />
      <h1 className="folio-h2">Your business access is pending.</h1><p className="folio-body">An admin at {pending.organization.name} needs to approve your request. Once you have access, return here to import your website and prepare your workspace.</p>
      <Link className="auth-submit" href={here}>Check my access</Link><Link className="block underline" href="/settings">View my access requests</Link><Link className="block underline" href={professionalSetupHref(null, here)}>Join or create a different business</Link></ProfessionalSetupFrame>;
    if (orgId) notFound();
    redirect(professionalSetupHref(null, here));
  }
  let access;
  try { access = await importAccess(session.user.id, orgId); }
  catch (error) { if (error instanceof WorkspaceImportError) notFound(); throw error; }
  const rows = await prisma.importSession.findMany({ where: { userId: session.user.id,
    AND: [{ processingMeta: { path: ['kind'], equals: WORKSPACE_IMPORT_KIND } }, { processingMeta: { path: ['orgId'], equals: orgId } }] },
    select: { id: true, createdAt: true, processingMeta: true }, orderBy: { createdAt: 'desc' }, take: 10 });
  const history = rows.filter(row => isWorkspaceImport(row.processingMeta)).map(row => ({ id: row.id, date: row.createdAt.toISOString(),
    phase: isWorkspaceImport(row.processingMeta) ? row.processingMeta.phase : 'blocked' }));
  return <WorkspaceImportClient key={orgId + (searchParams.import || searchParams.new || '')} access={access}
      memberships={memberships.map(member => member.organization)} history={history}
      initialId={searchParams.import || (searchParams.new === '1' ? undefined : history[0]?.id)}
      returnTo={access.canImportProjects ? firmWorkspaceDestination(access, returnTo) : `/org/${orgId}`}
      available={!!process.env.CRON_SECRET && !!process.env.RESEND_API_KEY} />;
}
