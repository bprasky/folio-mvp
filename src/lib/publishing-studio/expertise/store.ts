import 'server-only';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { StudioAccessError } from '../data';
import { digest, expertiseOwner, object } from './sources';
import type { ExpertiseOpportunity, ExpertiseSession, ExpertiseArticle } from './types';

export const EXPERTISE_KIND = 'my-expertise-v1';
export interface ExpertiseInterview {
  kind: typeof EXPERTISE_KIND; opportunity: ExpertiseOpportunity; session: ExpertiseSession;
  operations: string[]; derivatives: { id: string; revision: number; title: string; caption: string; mediaIds: string[]; createdAt: string }[];
}
export const storyId = (actor: string, workspace: string | null, opportunityId: string) => `expertise_${digest([actor, workspace, opportunityId]).slice(0, 40)}`;
export const candidateId = (actor: string, workspace: string | null, key: string) => `expertise_${digest([actor, workspace, key]).slice(0, 40)}`;
export const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
export const includeRevision = { answers: true, sources: true } as const;
export type ExpertiseRevision = Prisma.EditorialStoryRevisionGetPayload<{ include: typeof includeRevision }>;
export const interviewOf = (revision: ExpertiseRevision) => revision.interview as unknown as ExpertiseInterview;
export const articleOf = (revision: ExpertiseRevision) => object(revision.blocks).kind === EXPERTISE_KIND ? object(revision.blocks).article as ExpertiseArticle : null;

export async function ownedExpertise(actor: string, id: string, db: Prisma.TransactionClient = prisma) {
  const owner = await expertiseOwner(actor, db);
  const story = await db.editorialStory.findFirst({ where: { id, ownerId: actor, organizationId: owner.workspace.id, format: 'expertise' },
    include: { revisions: { orderBy: { number: 'desc' }, take: 1, include: includeRevision } } });
  if (!story?.revisions[0] || object(story.revisions[0].interview).kind !== EXPERTISE_KIND) throw new StudioAccessError('Article not found in this workspace.', 404);
  return { ...owner, story, revision: story.revisions[0] };
}

export async function storedOpportunities(actor: string, workspace: string | null, db: Prisma.TransactionClient = prisma) {
  const rows = await db.studioCandidate.findMany({ where: { designerId: actor, organizationId: workspace, id: { startsWith: 'expertise_' } },
    include: { versions: { orderBy: { version: 'desc' }, take: 1 } }, orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }], take: 100 });
  return rows.flatMap(row => {
    const snapshot = object(row.versions[0]?.snapshot);
    return snapshot.kind === EXPERTISE_KIND && snapshot.opportunity ? [{ opportunity: snapshot.opportunity as ExpertiseOpportunity, version: row.currentVersion, corpus: String(snapshot.corpus || '') }] : [];
  });
}

export async function discoveryState(actor: string, workspace: string | null, db: Prisma.TransactionClient = prisma): Promise<(Record<string, any> & { version: number; updatedAt: Date }) | null> {
  const id = candidateId(actor, workspace, 'discovery-cache');
  const row = await db.studioCandidate.findFirst({ where: { id, designerId: actor, organizationId: workspace }, include: { versions: { orderBy: { version: 'desc' }, take: 1 } } });
  return row ? { ...object(row.versions[0]?.snapshot), version: row.currentVersion, updatedAt: row.updatedAt } : null;
}
export async function saveDiscoveryState(actor: string, workspace: string | null, state: Record<string, unknown>) {
  return prisma.$transaction(async db => {
    const owner = await expertiseOwner(actor, db); if (owner.workspace.id !== workspace) throw new StudioAccessError('Your workspace changed.', 409);
    const id = candidateId(actor, workspace, 'discovery-cache');
    await db.studioCandidate.upsert({ where: { id }, create: { id, designerId: actor, organizationId: workspace, projectIds: [], currentVersion: 1, state: 'expertise_cache' }, update: {} });
    await db.$queryRaw`SELECT id FROM studio_candidates WHERE id=${id} FOR UPDATE`;
    const previous = await discoveryState(actor, workspace, db);
    if (state.status === 'processing' && previous?.status === 'processing' && Date.now() - previous.updatedAt.getTime() < 300000) throw new StudioAccessError('Your portfolio is already being reviewed.', 409);
    const version = (previous?.version || 0) + 1;
    await db.studioCandidateVersion.create({ data: { candidateId: id, version, sourceVersion: String(state.signature || 'none'), snapshot: json({ ...state, kind: 'my-expertise-discovery-v1' }) } });
    await db.studioCandidate.update({ where: { id }, data: { currentVersion: version } });
  }, { isolationLevel: 'Serializable' });
}

export async function saveOpportunity(actor: string, workspace: string | null, opportunity: ExpertiseOpportunity, corpus: string, expected: number | null, kind: string, reason?: string) {
  return prisma.$transaction(async db => {
    const owner = await expertiseOwner(actor, db);
    if (owner.workspace.id !== workspace) throw new StudioAccessError('Your workspace changed. Reload.', 409);
    const version = (expected ?? 0) + 1;
    if (expected === null) await db.studioCandidate.create({ data: { id: opportunity.id, designerId: actor, organizationId: workspace, projectIds: opportunity.projectIds, currentVersion: version, state: opportunity.state } });
    else {
      const changed = await db.studioCandidate.updateMany({ where: { id: opportunity.id, designerId: actor, organizationId: workspace, currentVersion: expected }, data: { currentVersion: version, state: opportunity.state, projectIds: opportunity.projectIds } });
      if (changed.count !== 1) throw new StudioAccessError('This opportunity changed. Reload.', 409);
    }
    await db.studioCandidateVersion.create({ data: { candidateId: opportunity.id, version, sourceVersion: opportunity.sourceSignature, snapshot: json({ kind: EXPERTISE_KIND, opportunity, corpus }) } });
    await db.studioCandidateEvent.create({ data: { id: `${opportunity.id}:${version}:${kind}`, candidateId: opportunity.id, version, sourceVersion: opportunity.sourceSignature, kind: `expertise_${kind}`, payload: json({ reason: reason || null }) } });
  }, { isolationLevel: 'Serializable' });
}
