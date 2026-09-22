import 'server-only';
import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { canAccessDesignerTools } from '@/lib/permissions';
import type { Candidate, CandidateEventKind } from './types';
import { loadCandidateSources, sourceVersion } from './sources';

export class CandidateConflictError extends Error {
  constructor() { super('This candidate changed. Reload before continuing.'); }
}

async function authorizeSource(tx: Transaction, candidate: Candidate) {
  await authorize(tx, candidate, candidate.projectIds);
  const ids = Array.from(new Set(candidate.projectIds));
  await tx.$queryRaw(Prisma.sql`SELECT id FROM project_images WHERE "projectId" IN (${Prisma.join(ids)}) ORDER BY id FOR SHARE`);
  await tx.$queryRaw(Prisma.sql`SELECT id FROM rooms WHERE "projectId" IN (${Prisma.join(ids)}) ORDER BY id FOR SHARE`);
  if (candidate.origin === 'direction') {
    const ideaId = candidate.sourceKey.slice('direction:'.length);
    await tx.$queryRaw`SELECT q.id FROM editorial_queue_items q JOIN designer_angles a ON a.id=q."angleId"
      WHERE q.id=${ideaId} FOR SHARE OF q,a`;
  }
  const data = await loadCandidateSources(candidate.designerId, tx);
  const current = data.sources.find(source => source.key === candidate.sourceKey);
  if (data.workspace.id !== candidate.organizationId || !current || sourceVersion(current) !== candidate.sourceVersion) {
    throw new CandidateConflictError();
  }
}

type Transaction = Prisma.TransactionClient;
type Owner = Pick<Candidate, 'designerId' | 'organizationId'>;
type Current = Owner & { currentVersion: number };

function assertEnabled() {
  if (process.env.STUDIO_EDITORIAL_READINESS !== 'true') throw new Error('Editorial readiness is not enabled');
}

/** The service supplies the authenticated actor, never request-body ownership. */
async function authorize(tx: Transaction, owner: Owner, projectIds?: string[]) {
  const users = await tx.$queryRaw<{ role: string; operatingAsOrgId: string | null }[]>`
    SELECT role, "operatingAsOrgId" FROM users WHERE id=${owner.designerId} FOR SHARE`;
  const user = users[0];
  if (!user || !canAccessDesignerTools(user.role) || user.operatingAsOrgId !== owner.organizationId) {
    throw new Error('Publishing workspace access is no longer available');
  }
  if (owner.organizationId) {
    const members = await tx.$queryRaw<{ role: string }[]>`
      SELECT role FROM organization_users WHERE "userId"=${owner.designerId}
      AND "organizationId"=${owner.organizationId} AND "isActive"=true FOR SHARE`;
    if (!members.some(member => ['OWNER', 'ADMIN', 'MANAGER', 'MEMBER'].includes(member.role))) {
      throw new Error('Publishing workspace access is no longer available');
    }
  }
  if (projectIds) {
    const ids = Array.from(new Set(projectIds));
    if (!ids.length) throw new Error('Candidate source projects are required');
    const rows = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
      SELECT id FROM projects WHERE id IN (${Prisma.join(ids)}) AND "isPublic"=true AND
      (${owner.organizationId}::text IS NOT NULL AND "designerOrgId"=${owner.organizationId}
       OR ${owner.organizationId}::text IS NULL AND "designerOrgId" IS NULL
         AND ("ownerId"=${owner.designerId} OR "designerId"=${owner.designerId})) ORDER BY id FOR SHARE`);
    if (rows.length !== ids.length) throw new Error('Candidate source access is no longer available');
    const posts = await tx.$queryRaw<{ projectId: string }[]>(Prisma.sql`
      SELECT "projectId" FROM project_posts WHERE "projectId" IN (${Prisma.join(ids)})
      AND status='PUBLISHED' ORDER BY "projectId" FOR SHARE`);
    if (posts.length !== ids.length) throw new Error('Candidate source is no longer published');
  }
}

function eventPayload(candidate: Candidate, payload: Record<string, unknown>) {
  return JSON.stringify({ ...payload, dimensions: candidate.dimensions, score: candidate.score, blockers: candidate.blockers });
}

async function recordEvent(tx: Transaction, candidate: Candidate, kind: CandidateEventKind, payload: Record<string, unknown>, id: string) {
  const body = eventPayload(candidate, payload);
  await tx.$executeRaw`INSERT INTO studio_candidate_events
    (id,"candidateId",version,"sourceVersion",kind,payload)
    VALUES (${id},${candidate.id},${candidate.version},${candidate.sourceVersion},${kind},${body}::jsonb)
    ON CONFLICT (id) DO NOTHING`;
  const matching = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM studio_candidate_events WHERE id=${id} AND "candidateId"=${candidate.id}
      AND version=${candidate.version} AND "sourceVersion"=${candidate.sourceVersion}
      AND kind=${kind} AND payload=${body}::jsonb`;
  if (!matching.length) throw new CandidateConflictError();
}

export async function listStoredCandidates(designerId: string, organizationId: string | null): Promise<Candidate[]> {
  assertEnabled();
  return prisma.$transaction(async tx => {
    await authorize(tx, { designerId, organizationId });
    const rows = await tx.$queryRaw<{ snapshot: Candidate }[]>`
      SELECT v.snapshot FROM studio_candidates c JOIN studio_candidate_versions v
        ON v."candidateId"=c.id AND v.version=c."currentVersion"
      WHERE c."designerId"=${designerId} AND c.id NOT LIKE 'expertise_%' AND c."organizationId" IS NOT DISTINCT FROM ${organizationId}::text
      ORDER BY c."updatedAt" DESC,c.id ASC`;
    const projects = await tx.project.findMany({
      where: { isPublic: true, post: { status: 'PUBLISHED' }, ...(organizationId ? { designerOrgId: organizationId } : {
        designerOrgId: null, OR: [{ ownerId: designerId }, { designerId }],
      }) }, select: { id: true },
    });
    const authorizedIds = new Set(projects.map(project => project.id));
    return rows.map(row => row.snapshot).filter(candidate => candidate.designerId === designerId
      && candidate.organizationId === organizationId && candidate.projectIds.length > 0
      && candidate.projectIds.every(id => authorizedIds.has(id)));
  });
}

export interface CandidateWork {
  candidate: Candidate;
  isCurrent: boolean;
  lastWorkedAt: string | null;
  exportedAt: string | null;
}

/** Author history remains readable when its source is private, unpublished or changed. */
export async function listCandidateWork(designerId: string, organizationId: string | null): Promise<CandidateWork[]> {
  assertEnabled();
  return prisma.$transaction(async tx => {
    await authorize(tx, { designerId, organizationId });
    const rows = await tx.$queryRaw<{ snapshot: Candidate; isCurrent: boolean; lastWorkedAt: Date | null; exportedAt: Date | null }[]>`
      SELECT v.snapshot,v.version=c."currentVersion" AS "isCurrent",
        CASE WHEN v.version=c."currentVersion" THEN
          (SELECT MAX(e."createdAt") FROM studio_candidate_events e WHERE e."candidateId"=c.id
            AND e.kind IN ('configured','answered','edited','published')) ELSE NULL END AS "lastWorkedAt",
        (SELECT MAX(e."createdAt") FROM studio_candidate_events e WHERE e."candidateId"=c.id
          AND e.version=v.version AND e."sourceVersion"=v."sourceVersion"
          AND e.kind='exported' AND e.payload->>'destination'='download') AS "exportedAt"
      FROM studio_candidates c JOIN studio_candidate_versions v
        ON v."candidateId"=c.id
      WHERE c."designerId"=${designerId} AND c.id NOT LIKE 'expertise_%' AND c."organizationId" IS NOT DISTINCT FROM ${organizationId}::text
        AND (v.version=c."currentVersion" OR EXISTS (
          SELECT 1 FROM studio_candidate_events e WHERE e."candidateId"=c.id AND e.version=v.version
            AND e."sourceVersion"=v."sourceVersion" AND e.kind='exported' AND e.payload->>'destination'='download'))
      ORDER BY c."updatedAt" DESC,c.id ASC,v.version DESC`;
    // This is saved author work, so publication filters would hide the very
    // drafts that need review. Ownership/workspace boundaries still apply.
    const projects = await tx.project.findMany({ where: organizationId ? {
      designerOrgId: organizationId, OR: [{ ownerId: designerId }, { designerId }, { isPublic: true, post: { status: 'PUBLISHED' } }],
    } : {
      designerOrgId: null, OR: [{ ownerId: designerId }, { designerId }],
    }, select: { id: true } });
    const authorizedIds = new Set(projects.map(project => project.id));
    return rows.filter(row => row.snapshot.designerId === designerId && row.snapshot.organizationId === organizationId
      && row.snapshot.projectIds.length > 0 && row.snapshot.projectIds.every(id => authorizedIds.has(id))
      && (row.lastWorkedAt || row.exportedAt)).map(row => ({ candidate: row.snapshot, isCurrent: row.isCurrent,
      lastWorkedAt: row.lastWorkedAt?.toISOString() ?? null, exportedAt: row.exportedAt?.toISOString() ?? null }));
  });
}

export interface SecondaryCandidateEvent { kind: CandidateEventKind; payload?: Record<string, unknown> }

export async function saveCandidate(candidate: Candidate, expectedVersion: number | null, eventKind: CandidateEventKind, payload: Record<string, unknown> = {}, secondaryEvents: SecondaryCandidateEvent[] = []): Promise<Candidate> {
  assertEnabled();
  if (candidate.version !== (expectedVersion ?? 0) + 1) throw new CandidateConflictError();
  return prisma.$transaction(async tx => {
    await authorizeSource(tx, candidate);
    if (expectedVersion === null) {
      const inserted = await tx.$executeRaw`INSERT INTO studio_candidates
        (id,"designerId","organizationId","projectIds","currentVersion",state,"updatedAt")
        VALUES (${candidate.id},${candidate.designerId},${candidate.organizationId},${candidate.projectIds}::text[],${candidate.version},${candidate.readiness},NOW())
        ON CONFLICT (id) DO NOTHING`;
      if (!inserted) throw new CandidateConflictError();
    } else {
      const current = await tx.$queryRaw<Current[]>`SELECT "designerId","organizationId","currentVersion"
        FROM studio_candidates WHERE id=${candidate.id} FOR UPDATE`;
      if (!current[0] || current[0].designerId !== candidate.designerId
        || current[0].organizationId !== candidate.organizationId || current[0].currentVersion !== expectedVersion) {
        throw new CandidateConflictError();
      }
      await tx.$executeRaw`UPDATE studio_candidates SET "projectIds"=${candidate.projectIds}::text[],
        "currentVersion"=${candidate.version},state=${candidate.readiness},"updatedAt"=NOW()
        WHERE id=${candidate.id}`;
    }
    await tx.$executeRaw`INSERT INTO studio_candidate_versions ("candidateId",version,"sourceVersion",snapshot)
      VALUES (${candidate.id},${candidate.version},${candidate.sourceVersion},${JSON.stringify(candidate)}::jsonb)`;
    await recordEvent(tx, candidate, eventKind, payload, randomUUID());
    for (const event of secondaryEvents) {
      await recordEvent(tx, candidate, event.kind, event.payload ?? {}, randomUUID());
    }
    return candidate;
  });
}

export async function appendEvent(candidate: Candidate, kind: CandidateEventKind, payload: Record<string, unknown> = {}, eventId: string = randomUUID()): Promise<void> {
  assertEnabled();
  await prisma.$transaction(async tx => {
    await authorizeSource(tx, candidate);
    const rows = await tx.$queryRaw<{ snapshot: Candidate }[]>`
      SELECT v.snapshot FROM studio_candidates c JOIN studio_candidate_versions v
        ON v."candidateId"=c.id AND v.version=c."currentVersion"
      WHERE c.id=${candidate.id} AND c."designerId"=${candidate.designerId}
        AND c."organizationId" IS NOT DISTINCT FROM ${candidate.organizationId}::text
        AND c."currentVersion"=${candidate.version} AND v."sourceVersion"=${candidate.sourceVersion}
      FOR UPDATE OF c`;
    if (!rows[0]) throw new CandidateConflictError();
    // Use persisted evaluation, so callers cannot falsify audit score/blockers.
    await recordEvent(tx, rows[0].snapshot, kind, payload, eventId);
  });
}
