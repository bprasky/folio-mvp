import 'server-only';
import { randomUUID } from 'crypto';
import { prisma } from '@/lib/prisma';
import { assertLiveActor } from '@/lib/live-interview/store';
import type { MediaRecord, MediaJob } from './types';
import { MediaError } from './types';

export async function readMedia<T>(actor: string, id: string): Promise<MediaRecord<T>> {
  const row = (await prisma.$queryRaw<MediaRecord<T>[]>`SELECT * FROM interview_media_records WHERE id=${id} AND "actorId"=${actor}`)[0];
  if (!row) throw new MediaError('Media not found.', 404);
  return row;
}
export async function listMedia(actor: string, sessionId?: string) {
  return prisma.$queryRaw<MediaRecord[]>`SELECT * FROM interview_media_records WHERE "actorId"=${actor}
    AND (${sessionId || null}::text IS NULL OR "sessionId"=${sessionId || null}) AND kind<>'job' ORDER BY "createdAt" DESC LIMIT 100`;
}
export async function publishedMedia(id: string) {
  return (await prisma.$queryRaw<MediaRecord[]>`SELECT * FROM interview_media_records WHERE id=${id} AND kind='plan' AND state='published'`)[0] || null;
}
export async function reservedSessionBytes(actor: string, sessionId: string) {
  const rows = await prisma.$queryRaw<{ bytes: bigint }[]>`SELECT COALESCE(sum((chunk->>'bytes')::bigint),0) AS bytes
    FROM interview_media_records run CROSS JOIN LATERAL jsonb_array_elements(run.payload->'chunks') chunk
    WHERE run."actorId"=${actor} AND run."sessionId"=${sessionId} AND run.kind='capture'`;
  return Number(rows[0]?.bytes || 0);
}
export async function createMedia<T>(actor: string, sessionId: string, kind: 'capture' | 'plan', state: string, payload: T) {
  return prisma.$transaction(async tx => {
    await assertLiveActor(tx, actor);
    const session = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM live_interview_sessions WHERE id=${sessionId} AND "actorId"=${actor} FOR SHARE`;
    if (!session.length) throw new MediaError('Interview not found.', 404);
    return (await tx.$queryRaw<MediaRecord<T>[]>`INSERT INTO interview_media_records (id,"actorId","sessionId",kind,state,payload)
      VALUES (${randomUUID()},${actor},${sessionId},${kind},${state},${JSON.stringify(payload)}::jsonb) RETURNING *`)[0];
  });
}
/** Actor ownership and role are checked in the same transaction as every document mutation. */
export async function mutateMedia<T>(actor: string, id: string, change: (row: MediaRecord<T>) => void, expected?: number) {
  return prisma.$transaction(async tx => {
    await assertLiveActor(tx, actor);
    const row = (await tx.$queryRaw<MediaRecord<T>[]>`SELECT * FROM interview_media_records WHERE id=${id} AND "actorId"=${actor} FOR UPDATE`)[0];
    if (!row) throw new MediaError('Media not found.', 404);
    if (expected !== undefined && row.version !== expected) throw new MediaError('This media version changed. Reload.', 409);
    change(row);
    return (await tx.$queryRaw<MediaRecord<T>[]>`UPDATE interview_media_records SET state=${row.state},payload=${JSON.stringify(row.payload)}::jsonb,
      version=version+1,"updatedAt"=now() WHERE id=${id} AND "actorId"=${actor} RETURNING *`)[0];
  });
}
export async function enqueueMedia(actor: string, target: MediaRecord, task: MediaJob['task']) {
  const key = `${task}:${target.id}:${target.version}`;
  await prisma.$transaction(async tx => {
    await assertLiveActor(tx, actor);
    const source = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM interview_media_records WHERE id=${target.id} AND "actorId"=${actor} AND version=${target.version} FOR SHARE`;
    if (!source.length) throw new MediaError('The source changed before queueing.', 409);
    await tx.$executeRaw`INSERT INTO interview_media_records (id,"actorId","sessionId",kind,state,payload,"jobKey")
      VALUES (${randomUUID()},${actor},${target.sessionId},'job','queued',${JSON.stringify({ task, targetId: target.id, targetVersion: target.version })}::jsonb,${key}) ON CONFLICT ("jobKey") DO NOTHING`;
  });
}
export async function claimMediaJob(): Promise<MediaRecord<MediaJob> | null> {
  // Expired leases are reclaimable; the lease token fences completion by stale workers.
  return prisma.$transaction(async tx => {
    await tx.$executeRaw`UPDATE interview_media_records run SET state='incomplete',
      payload=jsonb_set(run.payload,'{error}','"Recording recovery expired before all chunks were finalized. Saved interview answers are unaffected."'::jsonb),"updatedAt"=now()
      FROM live_interview_sessions session WHERE run.kind='capture' AND run.state='recording' AND run."sessionId"=session.id
        AND run."updatedAt"<now()-interval '24 hours' AND (session."expiresAt"<now() OR session.status IN ('ended','failed'))`;
    await tx.$executeRaw`UPDATE interview_media_records target SET state='failed',
      payload=jsonb_set(target.payload,'{error}','"The worker stopped repeatedly. Retry finalization or rendering."'::jsonb),"updatedAt"=now()
      FROM interview_media_records job WHERE job.kind='job' AND job.attempts>=3 AND job.state='working' AND job."leaseUntil"<now()
        AND target.id=job.payload->>'targetId' AND target."actorId"=job."actorId" AND target.version=(job.payload->>'targetVersion')::integer
        AND target.state IN ('processing','queued')`;
    await tx.$executeRaw`UPDATE interview_media_records SET state='failed',payload=jsonb_set(payload,'{error}','"Retry limit reached"'::jsonb)
      WHERE kind='job' AND attempts>=3 AND state='working' AND "leaseUntil"<now()`;
    const row = (await tx.$queryRaw<MediaRecord<MediaJob>[]>`SELECT * FROM interview_media_records WHERE kind='job' AND attempts<3
      AND "availableAt"<=now() AND (state='queued' OR (state='working' AND "leaseUntil"<now())) ORDER BY "createdAt" FOR UPDATE SKIP LOCKED LIMIT 1`)[0];
    if (!row) return null;
    return (await tx.$queryRaw<MediaRecord<MediaJob>[]>`UPDATE interview_media_records SET state='working',attempts=attempts+1,
      "leaseToken"=${randomUUID()},"leaseUntil"=now()+interval '90 seconds',"updatedAt"=now() WHERE id=${row.id} RETURNING *`)[0];
  });
}
export async function renewMediaJob(job: MediaRecord<MediaJob>) {
  const rows = await prisma.$queryRaw<{ id: string }[]>`UPDATE interview_media_records SET "leaseUntil"=now()+interval '90 seconds'
    WHERE id=${job.id} AND state='working' AND "leaseToken"=${job.leaseToken} AND "leaseUntil">now() RETURNING id`;
  if (!rows.length) throw new MediaError('Job cancelled or lease expired.', 409);
}
export async function finishMediaJob(job: MediaRecord<MediaJob>, failure?: string) {
  await prisma.$executeRaw`UPDATE interview_media_records SET state=${failure ? job.attempts >= 3 ? 'failed' : 'queued' : 'done'},
    payload=${JSON.stringify({ ...job.payload, ...(failure ? { error: failure } : {}) })}::jsonb,
    "availableAt"=now()+interval '30 seconds',"leaseUntil"=NULL,"updatedAt"=now()
    WHERE id=${job.id} AND "leaseToken"=${job.leaseToken} AND state='working'`;
}
export async function completeMediaTarget<T>(job: MediaRecord<MediaJob>, payload: T) {
  return prisma.$transaction(async tx => {
    await assertLiveActor(tx, job.actorId);
    const lease = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM interview_media_records WHERE id=${job.id}
      AND "leaseToken"=${job.leaseToken} AND state='working' AND "leaseUntil">now() FOR UPDATE`;
    if (!lease.length) throw new MediaError('The worker lease expired or this job was cancelled.', 409);
    const changed = await tx.$executeRaw`UPDATE interview_media_records SET payload=${JSON.stringify(payload)}::jsonb,
      state='ready',version=version+1,"updatedAt"=now() WHERE id=${job.payload.targetId} AND "actorId"=${job.actorId}
      AND version=${job.payload.targetVersion} AND state IN ('processing','queued')`;
    if (changed !== 1) throw new MediaError('The media changed while rendering.', 409);
    await tx.$executeRaw`UPDATE interview_media_records SET state='done',"leaseUntil"=NULL,"updatedAt"=now() WHERE id=${job.id}`;
  });
}
export async function failMediaTarget(job: MediaRecord<MediaJob>, error: string) {
  if (job.attempts < 3) return;
  await prisma.$executeRaw`UPDATE interview_media_records SET state='failed',payload=jsonb_set(payload,'{error}',${JSON.stringify(error)}::jsonb),"updatedAt"=now()
    WHERE id=${job.payload.targetId} AND "actorId"=${job.actorId} AND version=${job.payload.targetVersion} AND state IN ('processing','queued')`;
}
export async function cancelMediaJobs(actor: string, targetId: string) {
  await prisma.$transaction(async tx => {
    await assertLiveActor(tx, actor);
    await tx.$executeRaw`UPDATE interview_media_records SET state='cancelled',"leaseUntil"=NULL WHERE "actorId"=${actor}
      AND kind='job' AND payload->>'targetId'=${targetId} AND state IN ('queued','working')`;
  });
}
