import 'server-only';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { bioSourceFingerprint } from './prepared';
import { assertImportSections, importAccess, ownedImport, saveImport, WorkspaceImportError } from './store';
import { hasUnfinishedItems, importSummary } from './types';

export const reviewSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('retry') }),
  z.object({ action: z.literal('business'), version: z.string().datetime(), description: z.string().trim().max(4000),
    location: z.string().trim().max(120), useLogo: z.boolean() }),
  z.object({ action: z.literal('bio'), version: z.string().datetime().nullable(), bio: z.string().trim().min(1).max(4000) }),
]);

export async function readImportReview(userId: string, id: string) {
  const { run } = await ownedImport(userId, id);
  const [access, business, bio] = await Promise.all([
    importAccess(userId, run.orgId),
    prisma.organization.findUniqueOrThrow({ where: { id: run.orgId }, select: { description: true, location: true, website: true, logo: true, updatedAt: true } }),
    prisma.designerBio.findUnique({ where: { userId }, select: { updatedAt: true, status: true } }),
  ]);
  // A reader sees useful progress, not the worker's lease or the notification recipient.
  const { lease, notification, ...visible } = run;
  return { id, run: { ...visible, notification: { status: notification.status, error: notification.error, attempts: notification.attempts } },
    summary: importSummary(run), access, business, bioVersion: bio?.updatedAt || null,
    canReview: ['complete', 'blocked'].includes(run.phase) && (!lease || Date.parse(lease.until) <= Date.now()) };
}

export async function reviewImport(userId: string, id: string, input: z.infer<typeof reviewSchema>) {
  const { run, row } = await ownedImport(userId, id);
  if (!['complete', 'blocked'].includes(run.phase) || run.lease && Date.parse(run.lease.until) > Date.now())
    throw new WorkspaceImportError('Your import is still saving. Review it when preparation finishes.', 409);
  if (input.action === 'retry') {
    await assertImportSections(userId, run);
    if (!hasUnfinishedItems(run)) throw new WorkspaceImportError('There are no unfinished items to retry. Add specific page links in a new import if content is missing.');
    if ((run.retryCount || 0) >= 3) throw new WorkspaceImportError('This import has reached its retry limit. Open the saved drafts or start a new import with specific page links.', 429);
    run.retryCount = (run.retryCount || 0) + 1;
    run.recoveries = 0; delete run.lease;
    run.notices = [];
    for (const page of run.pages) if (page.status === 'failed') { page.status = 'pending'; page.attempts = 0; delete page.error; }
    for (const project of run.projects) {
      const missingPhotos = project.photos.some(photo => photo.status === 'failed');
      for (const photo of project.photos) if (photo.status === 'failed') { photo.status = 'pending'; photo.attempts = 0; }
      if (project.status === 'failed' || missingPhotos) {
        project.status = project.projectId ? missingPhotos ? 'photos' : 'questions' : 'pending';
        project.attempts = 0; delete project.error;
      }
    }
    run.profileAttempts = 0; run.phase = 'discover';
    // A manual recovery does not resend an email already sent for this import.
    await saveImport(id, row.processingMeta, run);
    return;
  }
  await prisma.$transaction(async tx => {
    await assertImportSections(userId, { orgId: run.orgId, sections: [input.action] }, tx);
    if (!run.sections.includes(input.action)) throw new WorkspaceImportError('This section was not selected for import.');
    if (input.action === 'business') {
      const updated = await tx.organization.updateMany({ where: { id: run.orgId, updatedAt: new Date(input.version) },
        data: { description: input.description || null, location: input.location || null, website: run.website,
          ...(input.useLogo && run.profile.logo ? { logo: run.profile.logo } : {}) } });
      if (!updated.count) throw new WorkspaceImportError('Your business profile changed. Refresh and review the current details before saving.', 409);
      run.profile.businessApplied = true;
    } else {
      const source = { name: run.personName, bio: input.bio, sourceUrl: run.profile.bioSourceUrl };
      const fingerprint = bioSourceFingerprint(source);
      const data = { scrapedData: JSON.parse(JSON.stringify({ ...source,
        ...(run.profile.bioQuestions?.length && fingerprint === run.profile.bioFingerprint ?
          { _folioPreparation: { fingerprint, role: run.profile.bioRole, questions: run.profile.bioQuestions } } : {}) })),
        scrapedAt: new Date(), sourceUrl: run.profile.bioSourceUrl || run.website };
      if (input.version) {
        const existing = await tx.designerBio.findUnique({ where: { userId }, select: { status: true } });
        const updated = await tx.designerBio.updateMany({ where: { userId, updatedAt: new Date(input.version) }, data: { ...data, ...(existing?.status === 'empty' ? { status: 'scraped' } : {}) } });
        if (!updated.count) throw new WorkspaceImportError('Your bio changed. Refresh before saving this interview context.', 409);
      } else {
        if (await tx.designerBio.findUnique({ where: { userId }, select: { id: true } }))
          throw new WorkspaceImportError('Your bio changed. Refresh before saving this interview context.', 409);
        await tx.designerBio.create({ data: { ...data, userId, status: 'scraped' } });
      }
      run.profile.bioApplied = true;
    }
    await saveImport(id, row.processingMeta, run, tx);
  });
}
