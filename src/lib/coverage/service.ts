import { createHash } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { can, isOrgRole } from '@/lib/orgPermissions';
import { publishedProjectHref } from '@/lib/post/published-story-href';
import { isDocumentImage } from '@/lib/publish/computePublishReadiness';
import { parseProductUrl } from '@/lib/server/safe-product-url';
import { discoverCoverage, readCoverageSource } from './source';
import { COVERAGE_KIND, coverageUrl, readCoverage, reviewItem, publicCoverage,
  type CoverageScope, type CoverageRecord, type CoverageReview, type PublicCoverage } from './schema';

export class CoverageError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export function scopeWhere(scope: CoverageScope): Prisma.ImportSessionWhereInput {
  return { sourceType: 'WEBSITE', AND: [
    { processingMeta: { path: ['kind'], equals: COVERAGE_KIND } },
    { processingMeta: { path: ['scope', 'type'], equals: scope.type } },
    { processingMeta: { path: ['scope', 'id'], equals: scope.id } },
  ] };
}
export async function authorizeCoverage(actorId: string, scope: CoverageScope) {
  if (scope.type === 'person') {
    if (scope.id !== actorId) throw new CoverageError('This profile is not available to edit.', 403);
    const user = await prisma.user.findFirst({ where: { id: actorId, accountStatus: 'APPROVED' }, select: { name: true, website: true, location: true } });
    if (!user) throw new CoverageError('This profile is not available to edit.', 403);
    return user;
  }
  const membership = await prisma.organizationUser.findFirst({
    where: { userId: actorId, organizationId: scope.id, isActive: true },
    select: { role: true, organization: { select: { name: true, website: true, location: true } } },
  });
  if (!membership || !isOrgRole(membership.role) || !can(membership.role, 'edit_org_profile'))
    throw new CoverageError('Only a studio profile editor can manage this coverage.', 403);
  return membership.organization;
}
function projectScope(scope: CoverageScope): Prisma.ProjectWhereInput {
  return scope.type === 'organization' ? { designerOrgId: scope.id } : { OR: [{ designerId: scope.id }, { ownerId: scope.id }] };
}
export async function coverageReviewList(actorId: string, scope: CoverageScope) {
  await authorizeCoverage(actorId, scope);
  const [rows, projects] = await Promise.all([
    prisma.importSession.findMany({ where: scopeWhere(scope), orderBy: { createdAt: 'desc' }, take: 100,
      select: { id: true, updatedAt: true, processingMeta: true } }),
    prisma.project.findMany({ where: projectScope(scope), select: { id: true, title: true, isPublic: true }, orderBy: { updatedAt: 'desc' }, take: 200 }),
  ]);
  return { items: rows.flatMap(row => { const record = readCoverage(row.processingMeta); return record ? [reviewItem(row.id, row.updatedAt, record)] : []; }), projects };
}
function coverageId(scope: CoverageScope, url: string) {
  return `coverage-${createHash('sha256').update(JSON.stringify([scope.type, scope.id, url])).digest('hex').slice(0, 48)}`;
}
async function saveCandidate(actorId: string, record: CoverageRecord) {
  // Re-running search preserves approval, dismissal and all human edits.
  return prisma.importSession.upsert({ where: { id: coverageId(record.scope, record.url) }, update: {},
    create: { id: coverageId(record.scope, record.url), userId: actorId, sourceType: 'WEBSITE', sourceUrl: record.url,
      status: 'READY_FOR_REVIEW', processingMeta: record as Prisma.InputJsonValue },
    select: { id: true },
  });
}
export async function findCoverage(actorId: string, scope: CoverageScope, link?: string) {
  const identity = await authorizeCoverage(actorId, scope);
  let candidates;
  if (link) {
    const url = coverageUrl(link);
    if (!url) throw new CoverageError('Enter a complete publication URL.');
    try { parseProductUrl(url); } catch { throw new CoverageError('Choose a public publication URL.'); }
    candidates = [{ url, title: 'Add the feature headline', source: new URL(url).hostname.replace(/^www\./, ''), category: 'feature' as const,
      matchReason: 'You added this link. Confirm the headline and that it features your work.' }];
  } else {
    const projects = await prisma.project.findMany({ where: projectScope(scope), select: { id: true, title: true }, orderBy: { updatedAt: 'desc' }, take: 30 });
    candidates = await discoverCoverage({ ...identity, projects });
  }
  // Recheck membership after the external request, before persisting scoped work.
  await authorizeCoverage(actorId, scope);
  for (const candidate of candidates) await saveCandidate(actorId, {
    ...candidate, kind: COVERAGE_KIND, scope, state: 'pending', publicationDate: null,
    discoveredBy: link ? 'link' : 'search', reviewedAt: null, reviewedBy: null, projectId: candidate.projectId ?? null,
    useForInterview: false, readStatus: 'unread', readAt: null, sourceText: '', readMessage: '',
  });
  return { found: candidates.length, ...await coverageReviewList(actorId, scope) };
}
export async function reviewCoverage(actorId: string, input: CoverageReview) {
  const row = await prisma.importSession.findUnique({ where: { id: input.id }, select: { id: true, updatedAt: true, processingMeta: true } });
  const record = readCoverage(row?.processingMeta);
  if (!row || !record) throw new CoverageError('Coverage was not found.', 404);
  await authorizeCoverage(actorId, record.scope);
  if (row.updatedAt.toISOString() !== input.version) throw new CoverageError('This feature changed. Reload the review before saving.', 409);
  let next: CoverageRecord = { ...record };
  if (input.action === 'read') {
    next = { ...next, ...await readCoverageSource(record.url) };
    // Reading a source never grants interview or publication permission.
    if (next.readStatus !== 'read') next.useForInterview = false;
  } else if (input.action === 'approve') {
    const projectId = input.projectId ?? null;
    if (projectId && !await prisma.project.findFirst({ where: { id: projectId, ...projectScope(record.scope) }, select: { id: true } }))
      throw new CoverageError('Choose a project belonging to this profile.', 403);
    const title = input.title ?? record.title;
    if (title === 'Add the feature headline') throw new CoverageError('Add the feature headline before publishing.');
    if (input.publicationDate && (Number.isNaN(Date.parse(input.publicationDate)) || new Date(input.publicationDate).toISOString().slice(0, 10) !== input.publicationDate))
      throw new CoverageError('Enter a valid publication date or leave it blank.');
    if (input.useForInterview && next.readStatus === 'unread' && (projectId || next.scope.type === 'person'))
      next = { ...next, ...await readCoverageSource(record.url) };
    next = { ...next, title, source: input.source ?? record.source, category: input.category ?? record.category,
      publicationDate: input.publicationDate ?? null, projectId,
      useForInterview: !!input.useForInterview && next.readStatus === 'read' && (!!projectId || next.scope.type === 'person'),
      state: 'approved', reviewedAt: new Date().toISOString(), reviewedBy: actorId };
  } else next = { ...next, state: 'dismissed', useForInterview: false, reviewedAt: null, reviewedBy: null };
  await authorizeCoverage(actorId, record.scope);
  const updated = await prisma.importSession.updateMany({ where: { id: row.id, updatedAt: row.updatedAt },
    data: { processingMeta: next as Prisma.InputJsonValue, projectId: next.projectId,
      status: next.state === 'approved' ? 'COMPLETED' : 'READY_FOR_REVIEW', completedAt: next.state === 'approved' ? new Date() : null } });
  if (updated.count !== 1) throw new CoverageError('This feature changed. Reload the review before saving.', 409);
  return coverageReviewList(actorId, record.scope);
}

const approvedWhere: Prisma.ImportSessionWhereInput = { sourceType: 'WEBSITE', status: 'COMPLETED', AND: [
  { processingMeta: { path: ['kind'], equals: COVERAGE_KIND } }, { processingMeta: { path: ['state'], equals: 'approved' } },
] };
export async function getPublicCoverage(target: CoverageScope | { projectId: string }): Promise<PublicCoverage[]> {
  const rows = await prisma.importSession.findMany({
    where: { AND: [approvedWhere, 'projectId' in target ? { projectId: target.projectId } : scopeWhere(target)] },
    select: { id: true, processingMeta: true }, orderBy: { updatedAt: 'desc' }, take: 60,
  });
  const records = rows.flatMap(row => { const record = readCoverage(row.processingMeta); return record ? [{ id: row.id, record }] : []; });
  const projectIds = Array.from(new Set(records.map(value => value.record.projectId).filter((id): id is string => !!id)));
  const projects = projectIds.length ? await prisma.project.findMany({
    where: { id: { in: projectIds }, isPublic: true, publishedAt: { lte: new Date() } },
    select: { id: true, title: true, ownerId: true, designerId: true, designerOrgId: true, isPublic: true, publishedAt: true, portfolioPublishedAt: true,
      post: { select: { status: true, slug: true } },
      images: { where: { inclusion: 'INCLUDED' }, select: { url: true, name: true }, orderBy: { displayOrder: 'asc' }, take: 30 } },
  }) : [];
  return records.flatMap(({ id, record }) => {
    const item = publicCoverage(id, record);
    if (!item || ('projectId' in target ? record.projectId !== target.projectId : record.scope.type !== target.type || record.scope.id !== target.id)) return [];
    const project = projects.find(project => project.id === record.projectId &&
      (record.scope.type === 'organization' ? project.designerOrgId === record.scope.id : project.designerId === record.scope.id || project.ownerId === record.scope.id));
    const href = project && publishedProjectHref(project);
    // The profile may still show an approved press link, but never private project identity or imagery.
    if ('projectId' in target && (!project || !href)) return [];
    return [{ ...item, ...(project && href ? { project: { title: project.title, href }, imageUrl: project.images.find(image => !isDocumentImage(image.name))?.url ?? null } : {}) }];
  });
}

/** Private, project-scoped context. Never pass this return value to a public DTO. */
export async function getCoverageInterviewContext(projectId: string) {
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { ownerId: true, designerId: true, designerOrgId: true } });
  if (!project) return [];
  const rows = await prisma.importSession.findMany({ where: { ...approvedWhere, projectId },
    select: { id: true, processingMeta: true }, orderBy: { updatedAt: 'desc' }, take: 12 });
  return rows.flatMap(row => {
    const record = readCoverage(row.processingMeta);
    if (!record || record.projectId !== projectId || !record.useForInterview || record.readStatus !== 'read' || !record.sourceText || !publicCoverage(row.id, record)) return [];
    const matches = record.scope.type === 'organization' ? project.designerOrgId === record.scope.id : [project.ownerId, project.designerId].includes(record.scope.id);
    return matches ? [{ sourceId: row.id, title: record.title, publication: record.source, url: record.url, category: record.category,
      attribution: 'External reporting; not an accepted Folio answer', text: record.sourceText.slice(0, 8000) }] : [];
  }).slice(0, 4);
}

export async function getPersonalCoverageInterviewContext(userId: string) {
  const rows = await prisma.importSession.findMany({ where: { AND: [approvedWhere, scopeWhere({ type: 'person', id: userId })], projectId: null },
    select: { id: true, processingMeta: true }, orderBy: { updatedAt: 'desc' }, take: 12 });
  return rows.flatMap(row => {
    const record = readCoverage(row.processingMeta);
    if (!record || record.scope.type !== 'person' || record.scope.id !== userId || record.projectId || !record.useForInterview || record.readStatus !== 'read' || !record.sourceText || !publicCoverage(row.id, record)) return [];
    return [{ sourceId: row.id, title: record.title, publication: record.source, url: record.url,
      attribution: 'External reporting; not an accepted Folio answer', text: record.sourceText.slice(0, 8000) }];
  }).slice(0, 4);
}
