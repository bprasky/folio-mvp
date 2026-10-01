import 'server-only';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { normalizeRole } from '@/lib/permissions';

export interface LiveSession {
  id: string; actorId: string; sourceType: string; sourceId: string; canonicalId: string;
  status: string; credentialHash: string; expiresAt: Date; providerIds: Record<string, string>;
  payload: Record<string, any>; version: number; createdAt: Date; updatedAt: Date;
}
export type NewLiveSession = Omit<LiveSession, 'version' | 'createdAt' | 'updatedAt'>;
export class LiveStoreError extends Error {
  constructor(message: string, public status = 409) { super(message); }
}
const active = ['starting', 'active', 'paused', 'ending', 'uncertain'];

/** Source-specific authorization belongs to the adapter; this is the last actor/role check at the write boundary. */
export async function assertLiveActor(tx: Prisma.TransactionClient, actor: string) {
  const rows = await tx.$queryRaw<{ role: string }[]>`SELECT role FROM users WHERE id=${actor} FOR SHARE`;
  if (!rows[0] || !['DESIGNER', 'ADMIN', 'VENDOR', 'ARCHITECT', 'BUILDER', 'PHOTOGRAPHER'].includes(normalizeRole(rows[0].role)))
    throw new LiveStoreError('This account cannot contribute interview media.', 403);
}
export async function createLiveSession(input: NewLiveSession, limits: { maxActive: number; maxDailyActor: number }) {
  return prisma.$transaction(async tx => {
    await assertLiveActor(tx, input.actorId);
    // Serialize reservations only. No provider network calls may run under this lock.
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(73119401)`;
    if (input.payload.startRequestId) {
      const retry = (await tx.$queryRaw<LiveSession[]>`SELECT * FROM live_interview_sessions WHERE "actorId"=${input.actorId}
        AND payload->>'startRequestId'=${String(input.payload.startRequestId)} ORDER BY "createdAt" DESC LIMIT 1`)[0];
      if (retry) return { session: retry, created: false };
    }
    const competing = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM live_interview_sessions WHERE "sourceType"=${input.sourceType}
      AND "sourceId"=${input.sourceId} AND "actorId"<>${input.actorId} AND status=ANY(${active}::text[]) LIMIT 1`;
    if (competing.length) throw new LiveStoreError('Another contributor is interviewing this source. Try again after they finish.', 409);
    const prior = await tx.$queryRaw<LiveSession[]>`SELECT * FROM live_interview_sessions WHERE "actorId"=${input.actorId}
      AND "sourceType"=${input.sourceType} AND "sourceId"=${input.sourceId} AND status=ANY(${active}::text[]) ORDER BY "createdAt" DESC LIMIT 1`;
    if (prior[0]) return { session: prior[0], created: false };
    const counts = await tx.$queryRaw<{ active: bigint; daily: bigint }[]>`SELECT
      count(*) FILTER (WHERE status=ANY(${active}::text[])) AS active,
      count(*) FILTER (WHERE "actorId"=${input.actorId} AND "createdAt">now()-interval '24 hours') AS daily FROM live_interview_sessions`;
    if (Number(counts[0]?.active) >= limits.maxActive || Number(counts[0]?.daily) >= limits.maxDailyActor)
      throw new LiveStoreError('The live interview limit has been reached. Continue in text or try later.', 429);
    const rows = await tx.$queryRaw<LiveSession[]>`INSERT INTO live_interview_sessions
      (id,"actorId","sourceType","sourceId","canonicalId",status,"credentialHash","expiresAt","providerIds",payload)
      VALUES (${input.id},${input.actorId},${input.sourceType},${input.sourceId},${input.canonicalId},${input.status},
        ${input.credentialHash},${input.expiresAt},${JSON.stringify(input.providerIds)}::jsonb,${JSON.stringify(input.payload)}::jsonb) RETURNING *`;
    return { session: rows[0], created: true };
  });
}
export async function getLiveSession(id: string): Promise<LiveSession | null> {
  return (await prisma.$queryRaw<LiveSession[]>`SELECT * FROM live_interview_sessions WHERE id=${id}`)[0] || null;
}
export async function getLatestLiveSession(actorId: string, sourceType: string, sourceId: string, excludeId?: string, round = 1): Promise<LiveSession | null> {
  return (await prisma.$queryRaw<LiveSession[]>`SELECT * FROM live_interview_sessions WHERE "actorId"=${actorId}
    AND "sourceType"=${sourceType} AND "sourceId"=${sourceId} AND (${excludeId || null}::text IS NULL OR id<>${excludeId || null})
    AND COALESCE((payload->'source'->>'round')::integer,1)=${round} ORDER BY "createdAt" DESC LIMIT 1`)[0] || null;
}
export async function findLiveSessionByCredential(hash: string): Promise<LiveSession | null> {
  return (await prisma.$queryRaw<LiveSession[]>`SELECT * FROM live_interview_sessions WHERE "credentialHash"=${hash} AND "expiresAt">now()`)[0] || null;
}
/** Internal service API: authenticated HTTP callers must compare actorId before invoking. Callback is synchronous. */
export async function mutateLiveSession(id: string, change: (current: LiveSession) => LiveSession | void, options: { cleanup?: boolean } = {}) {
  return prisma.$transaction(async tx => {
    const current = (await tx.$queryRaw<LiveSession[]>`SELECT * FROM live_interview_sessions WHERE id=${id} FOR UPDATE`)[0];
    if (!current) throw new LiveStoreError('Interview not found.', 404);
    if (!options.cleanup) await assertLiveActor(tx, current.actorId);
    const draft = structuredClone(current);
    const next = change(draft) || draft;
    // Caller cannot transfer ownership, source, or credential through a JSON mutation.
    if (next.actorId !== current.actorId || next.sourceType !== current.sourceType || next.sourceId !== current.sourceId || next.id !== current.id)
      throw new LiveStoreError('The interview source cannot be changed.', 403);
    return (await tx.$queryRaw<LiveSession[]>`UPDATE live_interview_sessions SET status=${next.status},
      "canonicalId"=${next.canonicalId},"expiresAt"=${next.expiresAt},"providerIds"=${JSON.stringify(next.providerIds)}::jsonb,
      payload=${JSON.stringify(next.payload)}::jsonb,version=version+1,"updatedAt"=now() WHERE id=${id} RETURNING *`)[0];
  });
}
export async function listLiveSessionsForCleanup(limit = 100) {
  return prisma.$queryRaw<LiveSession[]>`SELECT * FROM live_interview_sessions WHERE status=ANY(${active}::text[])
    AND ("expiresAt"<now() OR status IN ('ending','uncertain') OR (status='starting' AND "updatedAt"<now()-interval '2 minutes')) ORDER BY "updatedAt" ASC LIMIT ${Math.min(100, Math.max(1, limit))}`;
}
