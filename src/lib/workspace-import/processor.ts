import 'server-only';
import { randomUUID } from 'crypto';
import sharp from 'sharp';
import { prisma } from '@/lib/prisma';
import { safeProductResource } from '@/lib/server/safe-product-url';
import { hasRenderWorker, renderProductPage } from '@/lib/server/render-product';
import { fetchProjectImage } from '@/lib/server/project-image-input';
import { saveBufferToProjectStorage } from '@/lib/storage';
import { requestIdentity } from '@/lib/persistence/requestIdentity';
import { createProjectOnce } from '@/lib/projects/createProject';
import { generateWebsiteContextQuestions } from '@/lib/designer-bio/questions';
import { sendEmail } from '@/lib/email/sendEmail';
import { extractWebsitePage, sameWebsite, websiteUrl } from './extract';
import { assertImportSections, importJson, saveImport, WorkspaceImportError } from './store';
import { bioSourceFingerprint, savePreparedProject } from './prepared';
import { IMPORT_LIMITS, WORKSPACE_IMPORT_KIND, importSummary, isWorkspaceImport, type WorkspaceImport, type ImportPage, type ImportedProject } from './types';

const LEASE_MS = 6 * 60_000;
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!));
const note = (run: WorkspaceImport, message: string) => { if (!run.notices.includes(message)) run.notices.push(message); };

async function readPage(url: string, kind: ImportPage['kind'], includeProjects: boolean) {
  let current = url;
  let fallback: { html: string; url: string } | undefined;
  const deadline = Date.now() + 25_000;
  for (let redirect = 0; redirect <= 5; redirect++) {
    const response = await safeProductResource(current, { maxBytes: 3 * 1024 * 1024, timeoutMs: Math.max(1, deadline - Date.now()) });
    if ([301, 302, 303, 307, 308].includes(response.status) && response.headers.location) {
      current = websiteUrl(response.headers.location, current);
      if (!sameWebsite(current, url)) throw new Error('This page redirects outside the selected website.');
      continue;
    }
    if (response.status >= 200 && response.status < 300 && /html/i.test(response.headers['content-type'] || '')) {
      const html = response.body.toString('utf8');
      fallback = { html, url: current };
      const extracted = extractWebsitePage(html, current);
      const missingPortfolio = includeProjects && (kind === 'home' || kind === 'portfolio') && !extracted.links.some(link => link.kind === 'project' || link.kind === 'portfolio');
      const missingPhotos = kind === 'project' && extracted.images.length === 0;
      if (!hasRenderWorker() || (extracted.text.length > 100 && !missingPortfolio && !missingPhotos)) return { html, url: current };
    }
    break;
  }
  if (hasRenderWorker()) {
    const rendered = await renderProductPage(current);
    if (rendered && rendered.status >= 200 && rendered.status < 300 && sameWebsite(rendered.finalUrl, url)) return { html: rendered.html, url: rendered.finalUrl };
  }
  if (fallback) return fallback;
  throw new Error('This page could not be read. Try a direct page link or upload files.');
}

export function collectPage(run: WorkspaceImport, page: ImportPage, result: ReturnType<typeof extractWebsitePage>) {
  const businessPage = page.kind === 'home' || page.kind === 'about';
  if (run.sections.includes('business') && businessPage) {
    if (!run.profile.description || page.kind === 'about') { run.profile.description = result.description; run.profile.sourceUrl = page.url; }
    run.profile.logoSource ||= result.logo;
    run.profile.location ||= result.location;
    run.profile.foundedYear ||= result.foundedYear;
  }
  if (run.sections.includes('bio')) {
    // Explicit bio URL is consent to use that person's page; automatic matches require identity evidence.
    const bio = page.url === run.bioUrl ? result.description : result.personalBio;
    if (bio) { run.profile.bio = bio; run.profile.bioSourceUrl = page.url; }
  }
  if (run.sections.includes('projects') && page.kind === 'project' && !run.projects.some(project => project.url === page.url)) {
    if (run.projects.length < IMPORT_LIMITS.projects) run.projects.push({ url: page.url, title: result.title || 'Imported project',
      description: result.description, status: 'pending', attempts: 0,
      photos: result.images.map(image => ({ ...image, status: 'pending', attempts: 0 })) });
    else note(run, `We reached the ${IMPORT_LIMITS.projects}-project limit for this import. You can add more project links in another import.`);
    if (result.imageCount > IMPORT_LIMITS.photos) note(run, `${result.title}: the first ${IMPORT_LIMITS.photos} photographs were selected. Add any remaining photographs in the project.`);
  }
  if (page.kind !== 'project') for (const link of result.links) {
    if (run.pages.some(value => value.url === link.url)) continue;
    if ((link.kind === 'project' || link.kind === 'portfolio') && !run.sections.includes('projects')) continue;
    if (link.kind === 'about' && !run.sections.includes('business') && !run.sections.includes('bio')) continue;
    if (link.kind === 'bio' && !run.sections.includes('bio')) continue;
    if (run.pages.length >= IMPORT_LIMITS.pages) { note(run, 'Some pages were outside this import’s page limit. Add any missing project links in another import.'); break; }
    if (link.kind === 'project' && run.pages.filter(value => value.kind === 'project').length >= IMPORT_LIMITS.projects) {
      note(run, `We found more than ${IMPORT_LIMITS.projects} projects. Add the remaining project links in another import.`); continue;
    }
    run.pages.push({ url: link.url, kind: link.kind, status: 'pending', attempts: 0 });
  }
  page.status = 'saved';
  delete page.error;
}

async function prepareProfiles(userId: string, run: WorkspaceImport) {
  if (run.sections.includes('business') && run.profile.logoSource && !run.profile.logo) {
    try {
      const source = await fetchProjectImage(run.profile.logoSource);
      const logo = await sharp(source.buffer, { limitInputPixels: 16_000_000 }).rotate().resize(256, 256, { fit: 'inside', withoutEnlargement: true }).png().toBuffer();
      run.profile.logo = `data:image/png;base64,${logo.toString('base64')}`;
    } catch { note(run, 'The logo could not be imported. You can upload it on your business profile.'); }
  }
  if (run.sections.includes('bio') && run.profile.bio && !run.profile.bioQuestions) {
    const source = { name: run.personName, bio: run.profile.bio, sourceUrl: run.profile.bioSourceUrl };
    if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_ENABLED === 'false') {
      note(run, 'Your bio text is saved. Personalized bio questions will be prepared when you start the interview.');
    } else {
      const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { role: true } });
      const questions = await generateWebsiteContextQuestions(source, user.role || 'DESIGNER');
      run.profile.bioQuestions = questions.filter(question => typeof question.question === 'string' && question.question.length <= 600).slice(0, 6);
      run.profile.bioFingerprint = bioSourceFingerprint(source);
      run.profile.bioRole = user.role || 'DESIGNER';
    }
  }
  if (run.sections.includes('bio') && !run.profile.bio) note(run, 'We could not confidently identify your personal bio. Add a direct link to your own bio page or enter it manually.');
  if (run.sections.includes('business') && !run.profile.description) note(run, 'We could not find an About description. You can write one when reviewing your business details.');
  if (run.sections.includes('projects') && !run.projects.length) note(run, 'No separate project pages were identified. Start another import with direct project links, or upload photographs.');
  run.profileReady = true;
  run.profileFailed = false;
  run.phase = 'projects';
}

async function prepareProject(userId: string, runId: string, run: WorkspaceImport, item: ImportedProject) {
  if (item.status === 'pending') {
    const requestId = requestIdentity('website-project-source', [userId, run.orgId, item.url]);
    const projectId = requestIdentity('project-create', [userId, run.orgId, requestId]);
    const existing = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true, ownerId: true, designerOrgId: true, post: { select: { provenance: true } } } });
    if (existing) {
      if (existing.ownerId !== userId || existing.designerOrgId !== run.orgId) throw new WorkspaceImportError('This project belongs to another workspace.', 403);
      const provenance = existing.post?.provenance as { websiteImport?: { runId?: string } } | null;
      if (provenance?.websiteImport?.runId && provenance.websiteImport.runId !== runId) {
        item.projectId = projectId; item.photos = []; item.status = 'ready';
        note(run, `${item.title} was already imported. Its existing edits were preserved.`); return;
      }
    } else {
      await assertImportSections(userId, run);
      await createProjectOnce(userId, run.orgId, requestId, { title: item.title, description: item.description, projectStatus: 'new_project' });
    }
    item.projectId = projectId;
    // Add provenance only once; a replay must not replace existing interview work.
    const { ensureGuidedPost, objectValue } = await import('@/lib/interview/guided/store');
    const post = await ensureGuidedPost(projectId, userId);
    if (!objectValue(post.provenance).websiteImport) {
      const { Prisma } = await import('@prisma/client');
      const updated = await prisma.projectPost.updateMany({ where: { id: post.id, updatedAt: post.updatedAt, provenance: { equals: post.provenance === null ? Prisma.DbNull : post.provenance } },
        data: { provenance: { ...objectValue(post.provenance), websiteImport: { runId, sourceUrl: item.url } } } });
      if (!updated.count) throw new Error('The project changed while its source was being saved.');
    }
    item.status = 'photos'; item.attempts = 0; return;
  }
  if (item.status === 'photos') {
    const photo = item.photos.find(value => value.status === 'pending');
    if (!photo) { item.status = 'questions'; item.attempts = 0; return; }
    photo.attempts++;
    try {
      const source = await fetchProjectImage(photo.url);
      const imageId = requestIdentity('photo-upload', [item.projectId!, source.buffer.toString('base64'), source.mime]);
      let saved = await prisma.projectImage.findUnique({ where: { id: imageId }, select: { id: true, url: true } });
      if (!saved) {
        await assertImportSections(userId, run);
        const stored = await saveBufferToProjectStorage({ projectId: item.projectId!, roomId: 'default', ...source, storageId: imageId });
        await assertImportSections(userId, run);
        saved = await prisma.projectImage.upsert({ where: { id: imageId }, update: {},
          create: { id: imageId, projectId: item.projectId!, url: stored.publicUrl, name: photo.alt || null }, select: { id: true, url: true } });
      }
      photo.imageId = saved.id; photo.savedUrl = saved.url; photo.status = 'saved';
    } catch (error) {
      if (error instanceof WorkspaceImportError) throw error;
      if (photo.attempts >= 2) photo.status = 'failed';
    }
    item.attempts = 0;
    return;
  }
  if (item.status === 'questions') {
    await assertImportSections(userId, run);
    item.preparation = await savePreparedProject(item.projectId!, userId, run.orgId);
    item.status = 'ready'; item.attempts = 0;
  }
}

export function readyEmail(run: WorkspaceImport, runId: string, origin: string) {
  const summary = importSummary(run);
  const useful = summary.projects > 0 || summary.business || summary.bio;
  const target = `/onboarding/workspace?import=${encodeURIComponent(runId)}`;
  const url = new URL(`/auth/signin?callbackUrl=${encodeURIComponent(target)}`, origin).href;
  const status = useful ? 'Your Folio workspace is ready to review' : 'Your Folio import needs a little help';
  const details = [summary.business ? 'Business details and logo suggestions are saved for review.' : '',
    summary.bio ? 'Your personal bio text is saved for review.' : '',
    summary.projects ? `${summary.projects} private project drafts and ${summary.photos} photographs are saved.` : '',
    summary.interviews ? `${summary.interviews} project interviews have opening questions prepared.` : ''].filter(Boolean);
  return { subject: status, html: `<h1>${escapeHtml(status)}</h1><p>${escapeHtml(run.orgName)}</p>${details.map(detail => `<p>${escapeHtml(detail)}</p>`).join('')}
    ${summary.needsAttention || !useful ? '<p>Some material needs your attention. Your workspace shows what was saved and what could not be imported.</p>' : ''}
    <p>Nothing has been published. Review your imported details, then choose a project to begin.</p><p><a href="${escapeHtml(url)}">Open my workspace</a></p>` };
}

/** One bounded unit. State is checkpointed after each page, photo and preparation. */
export async function advanceImport(userId: string, id: string, run: WorkspaceImport) {
  await assertImportSections(userId, run);
  if (run.phase === 'discover') {
    const page = run.pages.find(value => value.status === 'pending');
    if (!page) { run.phase = 'profiles'; return; }
    page.attempts++;
    try { const source = await readPage(page.url, page.kind, run.sections.includes('projects')); collectPage(run, page, extractWebsitePage(source.html, source.url, run.personName)); }
    catch { page.error = 'This page could not be read. Add its content manually or try a direct page link.'; if (page.attempts >= 2) page.status = 'failed'; }
    return;
  }
  if (run.phase === 'profiles') {
    run.profileAttempts++;
    try { await prepareProfiles(userId, run); }
    catch { if (run.profileAttempts >= 2) { note(run, 'Profile text is saved, but some preparation could not finish. Review the available details.'); run.profileReady = true; run.profileFailed = true; run.phase = 'projects'; } }
    return;
  }
  if (run.phase === 'projects') {
    const project = run.projects.find(value => value.status !== 'ready' && value.status !== 'failed');
    if (!project) { run.phase = 'notify'; return; }
    project.attempts++;
    try { await prepareProject(userId, id, run, project); }
    catch (error) {
      if (error instanceof WorkspaceImportError) throw error;
      if (project.attempts >= 3) { project.status = 'failed'; project.error = 'This project needs attention. Any saved photographs and details are safe.'; }
    }
    return;
  }
  if (run.phase === 'notify') {
    const notification = run.notification;
    if (notification.status !== 'pending') { run.phase = 'complete'; return; }
    // Resend keeps keys for 24h. Never retry an ambiguous send after its deduplication window.
    if (notification.firstAttemptAt && Date.now() - Date.parse(notification.firstAttemptAt) >= 23 * 60 * 60_000) {
      notification.status = 'failed'; notification.error = 'Email could not be confirmed. Your workspace is available here.'; run.phase = 'complete'; return;
    }
    notification.attempts++; notification.firstAttemptAt ||= new Date().toISOString();
    if (!notification.message) throw new Error('The readiness email must be checkpointed before sending.');
    const result = await sendEmail({ ...notification.message, idempotencyKey: `workspace-ready/${id}` });
    if (result.success) { notification.status = 'accepted'; run.phase = 'complete'; }
    else {
      notification.error = 'The readiness email could not be sent. Your workspace remains available here.';
      if (notification.attempts >= 4) { notification.status = 'failed'; run.phase = 'complete'; }
      else notification.nextAttemptAt = new Date(Date.now() + notification.attempts * 5 * 60_000).toISOString();
    }
  }
}

/** Cron is only the trigger. Durable rows, expiring leases and CAS own recovery. */
export async function processWorkspaceImports(budgetMs = 180_000) {
  const deadline = Date.now() + budgetMs;
  const rows = await prisma.importSession.findMany({ where: { status: 'PROCESSING', processingMeta: { path: ['kind'], equals: WORKSPACE_IMPORT_KIND } },
    orderBy: { updatedAt: 'asc' }, take: 20 });
  let processed = 0;
  for (const row of rows) {
    if (Date.now() > deadline - 90_000 || !isWorkspaceImport(row.processingMeta)) break;
    const run = structuredClone(row.processingMeta);
    if (run.lease && Date.parse(run.lease.until) > Date.now() || run.phase === 'notify' && run.notification.nextAttemptAt && Date.parse(run.notification.nextAttemptAt) > Date.now()) continue;
    if (run.lease) run.recoveries = (run.recoveries || 0) + 1;
    run.lease = { token: randomUUID(), until: new Date(Date.now() + LEASE_MS).toISOString() };
    try { await saveImport(row.id, row.processingMeta, run); } catch { continue; }
    let previous: unknown = importJson(run);
    try {
      if ((run.recoveries || 0) > 3) throw new WorkspaceImportError('Import paused after repeated interruptions. Your saved drafts are safe. Retry from the workspace.', 503);
      while (Date.now() < deadline - 90_000 && !['complete', 'blocked'].includes(run.phase)) {
        // Save the send timestamp BEFORE contacting the provider, so crash recovery respects its 24h window.
        if (run.phase === 'notify' && run.notification.status === 'pending') {
          run.notification.firstAttemptAt ||= new Date().toISOString();
          if (!run.notification.message) {
            const user = await prisma.user.findUniqueOrThrow({ where: { id: row.userId }, select: { email: true } });
            const origin = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://folioad.com';
            run.notification.message = { to: user.email, ...readyEmail(run, row.id, origin) };
          }
          await saveImport(row.id, previous, run); previous = importJson(run);
        }
        await advanceImport(row.userId, row.id, run);
        run.lease.until = new Date(Date.now() + LEASE_MS).toISOString();
        await saveImport(row.id, previous, run); previous = importJson(run); processed++;
        if (run.phase === 'notify' && run.notification.nextAttemptAt && Date.parse(run.notification.nextAttemptAt) > Date.now()) break;
      }
    } catch (error) {
      if (error instanceof WorkspaceImportError && error.status === 409) continue;
      run.phase = 'blocked'; note(run, error instanceof WorkspaceImportError ? error.message : 'Import paused. Your saved drafts are safe; retry from this workspace.');
    }
    delete run.lease;
    await saveImport(row.id, previous, run).catch(() => {});
  }
  return { processed };
}
