import 'server-only';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { canPublishFromOrg } from '@/lib/permissions';
import { PortfolioPublishInput, portfolioReviewVersion, publishPortfolio } from '@/lib/publish/portfolio';
import { isDocumentImage } from '@/lib/publish/computePublishReadiness';
import { importAccess, ownedImport, WorkspaceImportError } from './store';
import { readOrgAppearance } from '@/lib/org-profile-appearance';
import { IMPORT_LIMITS } from './types';
import { reviewProjectTitle } from './project-title';

export const ImportPublishInput = z.object({ projects: z.array(PortfolioPublishInput).min(1).max(IMPORT_LIMITS.projects),
  reviewedPortrait: z.string().url().max(2048).optional() }).strict();
async function access(userId: string, id: string) {
  const { run } = await ownedImport(userId, id);
  if (!['notify', 'complete', 'blocked'].includes(run.phase) || run.lease && Date.parse(run.lease.until) > Date.now())
    throw new WorkspaceImportError('Your photographs are still being saved. Review them when the import finishes.', 409);
  if (!(await canPublishFromOrg(userId, run.orgId)).ok) throw new WorkspaceImportError('A studio publisher needs to approve these photographs.', 403);
  return run;
}
export async function readImportPublication(userId: string, id: string) {
  const run = await access(userId, id);
  const projects = await prisma.project.findMany({
    where: { id: { in: run.projects.flatMap(p => p.projectId ? [p.projectId] : []) }, ownerId: userId, designerOrgId: run.orgId, isPublic: false,
      OR: [{ post: null }, { post: { is: { status: 'DRAFT' } } }] },
    select: { id: true, title: true, updatedAt: true, portfolioPublishedAt: true, portfolioCoverImageId: true,
      post: { select: { status: true } }, images: { orderBy: [{ displayOrder: 'asc' }, { id: 'asc' }],
        select: { id: true, url: true, name: true, inclusion: true, roomId: true, updatedAt: true } } },
  });
  let proposedPortrait: string | undefined;
  if (run.profile?.portrait && (await importAccess(userId, run.orgId)).canEditProfile) {
    const org = await prisma.organization.findUniqueOrThrow({ where: { id: run.orgId }, select: { profileAppearance: true } });
    if (readOrgAppearance(org.profileAppearance).portrait === undefined) proposedPortrait = run.profile.portrait.originalUrl;
  }
  return { profileHref: `/org/${encodeURIComponent(run.orgId)}`, proposedPortrait, projects: projects.flatMap(project => {
    const photos = project.images.filter(image => image.url && !isDocumentImage(image.name));
    if (!photos.length) return [];
    const title = reviewProjectTitle(run, project, run.projects.find(item => item.projectId === project.id));
    return [{ projectId: project.id, title, version: portfolioReviewVersion(project),
      coverImageId: project.portfolioCoverImageId, photos: photos.map(({ id, url, name, inclusion }) => ({ id, url, name, inclusion })) }];
  }) };
}
export async function publishImport(userId: string, id: string, raw: unknown) {
  const input = ImportPublishInput.parse(raw);
  const run = await access(userId, id);
  const allowed = new Set(run.projects.flatMap(p => p.projectId ? [p.projectId] : []));
  const ids = input.projects.map(p => p.projectId);
  if (new Set(ids).size !== ids.length || ids.some(projectId => !allowed.has(projectId)))
    throw new WorkspaceImportError('Choose projects from this import.', 403);
  const current = await prisma.project.findMany({ where: { id: { in: ids }, ownerId: userId, designerOrgId: run.orgId }, select: { id: true } });
  if (current.length !== ids.length) throw new WorkspaceImportError('Project ownership changed. Reload the review.', 409);
  if (input.reviewedPortrait && input.reviewedPortrait !== run.profile?.portrait?.originalUrl)
    throw new WorkspaceImportError('The studio portrait changed. Reload the review.', 409);
  // Each existing publisher rechecks permissions, locks its project and verifies the exact reviewed version.
  // Partial completion is explicit; a retry of an unchanged approval is idempotent.
  const results: Array<{ projectId: string; published: boolean; error?: string }> = [];
  for (const project of input.projects) {
    try { await publishPortfolio(userId, project); results.push({ projectId: project.projectId, published: true }); }
    catch { results.push({ projectId: project.projectId, published: false, error: 'Could not publish this project. Reload its photographs and check your publishing access before retrying.' }); }
  }
  let portraitError: string | undefined;
  const portrait = run.profile?.portrait;
  if (input.reviewedPortrait && portrait && results.some(result => result.published)) {
    try {
      await prisma.$transaction(async tx => {
        if (!(await importAccess(userId, run.orgId, tx)).canEditProfile) throw new Error('Profile access changed');
        const org = await tx.organization.findUniqueOrThrow({ where: { id: run.orgId }, select: { profileAppearance: true, updatedAt: true } });
        const appearance = readOrgAppearance(org.profileAppearance);
        if (appearance.portrait !== undefined) return;
        const saved = await tx.organization.updateMany({ where: { id: run.orgId, updatedAt: org.updatedAt },
          data: { profileAppearance: { ...appearance, portrait } } });
        if (!saved.count) throw new Error('Profile changed');
      });
    } catch { portraitError = 'Your projects were published. Open Change portrait on your cover to save the studio portrait.'; }
  }
  return { results, profileHref: `/org/${encodeURIComponent(run.orgId)}`, portraitError };
}
