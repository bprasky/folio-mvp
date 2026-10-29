import 'server-only';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { can, canCreateFirmProject, isOrgRole } from '@/lib/orgPermissions';
import { requestIdentity } from '@/lib/persistence/requestIdentity';
import { safeProfessionalCallback } from '@/lib/onboarding/professional-entry';
import { validateProductUrl } from '@/lib/server/safe-product-url';
import { websiteUrl, sameWebsite } from './extract';
import { WORKSPACE_IMPORT_KIND, isWorkspaceImport, type ImportSection, type WorkspaceImport } from './types';

export class WorkspaceImportError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export const importJson = (run: WorkspaceImport): Prisma.InputJsonValue => JSON.parse(JSON.stringify(run));
type Database = Pick<typeof prisma, 'organizationUser'>;

export async function importAccess(userId: string, orgId: string, db: Database = prisma) {
  const membership = await db.organizationUser.findFirst({ where: { userId, organizationId: orgId, isActive: true },
    select: { role: true, organization: { select: { id: true, name: true, type: true, website: true, status: true } } } });
  if (!membership || !isOrgRole(membership.role) || !can(membership.role, 'view_internal'))
    throw new WorkspaceImportError('Active business access is required. Your saved work has been kept.', 403);
  return { ...membership.organization, canEditProfile: can(membership.role, 'edit_org_profile'),
    canImportProjects: canCreateFirmProject(membership.role, membership.organization.type),
    canContribute: can(membership.role, 'create_and_edit_projects') };
}
export async function assertImportSections(userId: string, run: Pick<WorkspaceImport, 'orgId' | 'sections'>, db: Database = prisma) {
  const access = await importAccess(userId, run.orgId, db);
  if (!access.canContribute || (run.sections.includes('business') && !access.canEditProfile) ||
    (run.sections.includes('projects') && !access.canImportProjects))
    throw new WorkspaceImportError('Your business permissions no longer allow this import. Ask a business admin for access.', 403);
  return access;
}

export async function createWorkspaceImport(userId: string, input: {
  orgId: string; website: string; bioUrl?: string; projectUrls?: string[];
  sections: ImportSection[]; consent: true; requestId: string; returnTo?: string;
}) {
  const access = await assertImportSections(userId, input);
  const url = websiteUrl(input.website);
  await validateProductUrl(url);
  const bioUrl = input.bioUrl ? websiteUrl(input.bioUrl, url) : undefined;
  const projectUrls = Array.from(new Set((input.projectUrls || []).map(value => websiteUrl(value, url))));
  if ([bioUrl, ...projectUrls].some(value => value && !sameWebsite(value, url)))
    throw new WorkspaceImportError('Use pages from the same business website.');
  if ((bioUrl && !input.sections.includes('bio')) || (projectUrls.length && !input.sections.includes('projects')))
    throw new WorkspaceImportError('Select the sections associated with these page links.');
  const id = requestIdentity('workspace-import', [userId, input.orgId, input.requestId]);
  const sections = Array.from(new Set(input.sections)).sort();
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { name: true } });
  const run: WorkspaceImport = { kind: WORKSPACE_IMPORT_KIND, orgId: input.orgId, orgName: access.name, personName: user.name || '',
    website: url, bioUrl, sections, returnTo: safeProfessionalCallback(input.returnTo).startsWith('/onboarding/workspace') ? '/projects/new' : safeProfessionalCallback(input.returnTo), consentAt: new Date().toISOString(), consentVersion: 1,
    phase: 'discover', pages: [{ url, kind: 'home', status: 'pending', attempts: 0 },
      ...(bioUrl && bioUrl !== url ? [{ url: bioUrl, kind: 'bio' as const, status: 'pending' as const, attempts: 0 }] : []),
      ...projectUrls.filter(value => value !== url && value !== bioUrl).map(value => ({ url: value, kind: 'project' as const, status: 'pending' as const, attempts: 0 }))],
    projects: [], profile: { website: url, description: '', location: '' },
    notices: [], profileAttempts: 0, profileReady: false, notification: { status: 'pending', attempts: 0 } };
  await prisma.$transaction(async tx => {
    // Serialize each actor's starts: retries replay the same row and concurrent tabs share the quota.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(73195, hashtext(${userId}))`;
    await assertImportSections(userId, input, tx);
    const existing = await tx.importSession.findUnique({ where: { id } });
    if (existing) {
      const old = existing.processingMeta;
      if (!isWorkspaceImport(old) || old.website !== url || old.bioUrl !== bioUrl || JSON.stringify(old.sections) !== JSON.stringify(sections) ||
        JSON.stringify(old.requestedProjectUrls || []) !== JSON.stringify(projectUrls))
        throw new WorkspaceImportError('That request already started a different import. Reload to see the saved work.', 409);
      return;
    }
    const scope = { userId, processingMeta: { path: ['kind'], equals: WORKSPACE_IMPORT_KIND } };
    if (await tx.importSession.count({ where: { ...scope, status: 'PROCESSING' } }))
      throw new WorkspaceImportError('Your previous import is still running. Open it below to see its progress.', 409);
    if (await tx.importSession.count({ where: { ...scope, createdAt: { gte: new Date(Date.now() - 86_400_000) } } }) >= 5)
      throw new WorkspaceImportError('You can start five website imports per day. Your existing drafts are available below.', 429);
    run.requestedProjectUrls = projectUrls;
    await tx.importSession.create({ data: { id, userId, sourceType: 'WEBSITE', sourceUrl: url, status: 'PROCESSING', processingMeta: importJson(run) } });
  });
  return id;
}

export async function ownedImport(userId: string, id: string) {
  const row = await prisma.importSession.findFirst({ where: { id, userId } });
  if (!row || !isWorkspaceImport(row.processingMeta)) throw new WorkspaceImportError('Import not found.', 404);
  await importAccess(userId, row.processingMeta.orgId);
  return { row, run: structuredClone(row.processingMeta) as WorkspaceImport };
}

/** Entire-document CAS fences expired workers and concurrent review edits. */
export async function saveImport(id: string, previous: unknown, run: WorkspaceImport, db: Pick<typeof prisma, 'importSession'> = prisma) {
  const result = await db.importSession.updateMany({ where: { id, processingMeta: { equals: previous as Prisma.InputJsonValue } },
    data: { processingMeta: importJson(run), status: run.phase === 'complete' ? 'COMPLETED' : run.phase === 'blocked' ? 'FAILED' : 'PROCESSING',
      ...(run.phase === 'complete' ? { completedAt: new Date() } : {}) } });
  if (result.count !== 1) throw new WorkspaceImportError('The import changed. Refresh to see its saved progress.', 409);
}
