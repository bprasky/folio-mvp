import 'server-only';
import { z } from 'zod';
import { getLiveSession } from '@/lib/live-interview/store';
import { resolveMediaSource } from '@/lib/live-interview/adapters';
import { createMedia, readMedia, listMedia, mutateMedia, enqueueMedia, cancelMediaJobs, publishedMedia, reservedSessionBytes } from './store';
import { assertCaptureStorageReady, chunkUpload, inspectChunk, signedPrivate, storageKey, assertStorageKey } from './storage';
import { planDigest, planInput, validatePlanSources } from './plan';
import { MediaError, captureMime, MAX_CAPTURE_BYTES, MAX_CAPTURE_MS, MAX_CHUNK_BYTES, MAX_CHUNKS } from './types';
import type { Capture, EditPlan, MediaRecord } from './types';

const boundedId = z.string().min(1).max(100);
const captureInput = z.discriminatedUnion('action', [
  z.object({ action: z.literal('start'), sessionId: boundedId, mimeType: z.string().max(150), offsetMs: z.number().int().min(0).max(MAX_CAPTURE_MS) }),
  z.object({ action: z.literal('chunk'), runId: boundedId, index: z.number().int().min(0).max(MAX_CHUNKS - 1), bytes: z.number().int().positive().max(MAX_CHUNK_BYTES) }),
  z.object({ action: z.literal('ack'), runId: boundedId, index: z.number().int().min(0).max(MAX_CHUNKS - 1) }),
  z.object({ action: z.literal('finalize'), runId: boundedId, chunkCount: z.number().int().positive().max(MAX_CHUNKS), durationMs: z.number().int().positive().max(MAX_CAPTURE_MS) }),
  z.object({ action: z.literal('incomplete'), runId: boundedId, error: z.string().max(200).optional() }),
  z.object({ action: z.literal('retry'), runId: boundedId }),
]);
async function ownedSession(actor: string, id: string) {
  const session = await getLiveSession(id);
  if (!session || session.actorId !== actor) throw new MediaError('Interview not found.', 404);
  await resolveMediaSource(actor, session, 'preview');
  return session;
}
export async function captureAction(actor: string, raw: unknown) {
  const input = captureInput.parse(raw);
  if (input.action === 'start') {
    if (process.env.FOLIO_INTERVIEW_RECORDING !== '1') throw new MediaError('Recording is not enabled.', 404);
    const session = await ownedSession(actor, input.sessionId);
    const captureSource = await resolveMediaSource(actor, session, 'preview');
    const consent = session.payload.consent;
    if (!consent || !['audio', 'video'].includes(consent.mode) || !consent.version || !consent.at || !consent.disclosure)
      throw new MediaError('Explicit recording consent is required.', 403);
    if (!['starting', 'active', 'paused'].includes(session.status) || session.expiresAt.getTime() <= Date.now()) throw new MediaError('The live interview has ended.', 409);
    const mimeType = captureMime(input.mimeType);
    if (mimeType.startsWith('video/') && consent.mode !== 'video') throw new MediaError('Camera recording was not consented.', 403);
    await assertCaptureStorageReady();
    const previous = (await listMedia(actor, session.id)).filter(r => r.kind === 'capture');
    if (previous.some(r => r.state === 'recording')) throw new MediaError('Finish the previous recorder run before starting another.', 409);
    if (previous.length >= 100) throw new MediaError('The recording run limit has been reached.', 409);
    const run = await createMedia<Capture>(actor, session.id, 'capture', 'recording', {
      schemaVersion: 1, mimeType, offsetMs: input.offsetMs, durationMs: 0, chunks: [], consent,
      source: { sourceType: session.sourceType, sourceId: session.sourceId, canonicalId: session.canonicalId }, recordingScopeVersion: captureSource.recordingScopeVersion, speakerId: actor,
    });
    return { runId: run.id, maxChunkBytes: MAX_CHUNK_BYTES };
  }
  const run = await readMedia<Capture>(actor, input.runId);
  if (run.kind !== 'capture') throw new MediaError('Recording not found.', 404);
  await ownedSession(actor, run.sessionId);
  if (input.action === 'incomplete') {
    if (['ready', 'processing'].includes(run.state)) return { state: run.state };
    await mutateMedia<Capture>(actor, run.id, row => { row.state = 'incomplete'; row.payload.error = 'Recording stopped before a complete upload. Saved interview answers are unaffected.'; });
    return { state: 'incomplete' };
  }
  if (input.action === 'retry') {
    if (run.state !== 'failed' || !run.payload.durationMs || run.payload.chunks.some(chunk => !chunk.uploaded))
      throw new MediaError('Only a complete recording with failed processing can be retried.', 409);
    const retry = await mutateMedia<Capture>(actor, run.id, row => { row.state = 'processing'; delete row.payload.error; }, run.version);
    await enqueueMedia(actor, retry, 'finalize');
    return { state: 'processing' };
  }
  if (input.action === 'finalize' && ['processing', 'ready'].includes(run.state)) {
    if (run.state === 'processing') await enqueueMedia(actor, run, 'finalize');
    return { state: run.state };
  }
  if (run.state !== 'recording') throw new MediaError('This recording run is closed.', 409);
  if (input.action === 'chunk') {
    if (!run.payload.chunks[input.index] && await reservedSessionBytes(actor, run.sessionId) + input.bytes > MAX_CAPTURE_BYTES)
      throw new MediaError('This interview has reached its total recording storage limit.', 409);
    const key = storageKey(run.sessionId, run.id, `${input.index}.chunk`);
    await mutateMedia<Capture>(actor, run.id, row => {
      if (row.state !== 'recording') throw new MediaError('This recording run is closed.', 409);
      const existing = row.payload.chunks[input.index];
      if (existing) { if (existing.bytes !== input.bytes || existing.key !== key) throw new MediaError('A chunk cannot be replaced.', 409); return; }
      if (input.index !== row.payload.chunks.length || row.payload.chunks.reduce((n, c) => n + c.bytes, 0) + input.bytes > MAX_CAPTURE_BYTES)
        throw new MediaError('Recording chunks must arrive in order and within the recording limit.');
      row.payload.chunks.push({ index: input.index, key, bytes: input.bytes, uploaded: false });
    });
    return chunkUpload(key);
  }
  if (input.action === 'ack') {
    const chunk = run.payload.chunks[input.index];
    if (!chunk) throw new MediaError('This chunk was not reserved.', 409);
    await inspectChunk(chunk.key, chunk.bytes, run.payload.mimeType);
    await mutateMedia<Capture>(actor, run.id, row => { row.payload.chunks[input.index].uploaded = true; });
    return { saved: true };
  }
  const finalized = await mutateMedia<Capture>(actor, run.id, row => {
    if (row.state !== 'recording' || row.payload.chunks.length !== input.chunkCount || row.payload.chunks.some((c, i) => !c.uploaded || c.index !== i))
      throw new MediaError('Wait for every recording chunk, including the final data, to upload.', 409);
    row.state = 'processing'; row.payload.durationMs = input.durationMs;
  });
  await enqueueMedia(actor, finalized, 'finalize');
  return { state: 'processing' };
}

/** One eligibility boundary shared by worker, preview, approval, publication and delivery. */
export async function mediaEligibility(actor: string, record: MediaRecord<EditPlan>, purpose: 'preview' | 'export') {
  if (record.actorId !== actor || record.kind !== 'plan' || record.state === 'cancelled') throw new MediaError('Media unavailable.', 404);
  const current = await resolveMediaSource(actor, record.payload.source, purpose);
  if (current.version !== record.payload.sourceVersion) throw new MediaError('The interview source changed. Rebuild and approve this piece again.', 409);
  const captures = await Promise.all(Array.from(new Set(record.payload.scenes.map(s => s.captureId))).map(id => readMedia<Capture>(actor, id)));
  if (captures.some(run => run.payload.recordingScopeVersion !== current.recordingScopeVersion))
    throw new MediaError('A recorded source selection or permission changed. Capture new evidence before creating media.', 409);
  validatePlanSources(record.payload, captures, actor, current.images.map(image => image.id));
  if (purpose === 'export' && (!record.payload.approval || record.payload.approval.actorId !== actor ||
    record.payload.approval.digest !== planDigest(record.payload) || record.payload.output?.digest !== planDigest(record.payload) || !record.payload.publishedAt || !current.destination))
    throw new MediaError('Review, approve and publish this exact media version to Folio before export.', 409);
  return { current, captures };
}
export async function mediaLibrary(actor: string, sessionId?: string) {
  const rows = await listMedia(actor, sessionId);
  const result: Record<string, unknown>[] = [];
  const contexts = new Map<string, Promise<Awaited<ReturnType<typeof resolveMediaSource>>>>();
  for (const row of rows) {
    try {
      if (!contexts.has(row.sessionId)) contexts.set(row.sessionId, (async () => {
        const session = await getLiveSession(row.sessionId);
        if (!session || session.actorId !== actor) throw new MediaError('Interview unavailable.', 404);
        return resolveMediaSource(actor, session, 'preview');
      })());
      const source = await contexts.get(row.sessionId)!;
      if (row.kind === 'capture') {
        const payload = row.payload as Capture;
        result.push({ id: row.id, sessionId: row.sessionId, kind: row.kind, state: row.state, version: row.version,
          sourceKey: `${payload.source.sourceType}:${payload.source.sourceId}:${payload.source.canonicalId}`,
          mimeType: payload.mimeType, offsetMs: payload.offsetMs, durationMs: payload.durationMs, transcript: payload.transcript || [],
          moments: payload.moments || [], hasVideo: payload.hasVideo, error: payload.error, images: source.images, speakerId: payload.speakerId });
      } else {
        const plan = row.payload as EditPlan;
        result.push({ id: row.id, sessionId: row.sessionId, kind: row.kind, state: row.state, version: row.version,
          title: plan.title, description: plan.description, credits: plan.credits, format: plan.format, aspect: plan.aspect, scenes: plan.scenes, approved: plan.approval?.digest === planDigest(plan),
          published: Boolean(plan.publishedAt), error: plan.error, hasOutput: Boolean(plan.output), destination: plan.destination });
      }
    } catch { /* Omit revoked sources from the author library; never expose their private metadata. */ }
  }
  return { items: result };
}
export async function createPlan(actor: string, raw: unknown) {
  if (process.env.FOLIO_INTERVIEW_MEDIA_EXPORTS !== '1') throw new MediaError('Media creation is not enabled.', 404);
  const input = planInput.parse(raw);
  const session = await ownedSession(actor, input.sessionId);
  const source = await resolveMediaSource(actor, session, 'preview');
  const knownCredits = source.images.filter(image => input.scenes.some(scene => scene.imageId === image.id)).flatMap(image => image.credit ? [image.credit] : []);
  const credits = Array.from(new Set([source.speakerName, ...knownCredits, input.credits].filter(Boolean))).join(' · ');
  const plan: EditPlan = { schemaVersion: 1, title: input.title, description: input.description, credits,
    format: input.format, aspect: input.aspect, scenes: input.scenes, source: { sourceType: session.sourceType, sourceId: session.sourceId, canonicalId: session.canonicalId },
    sourceVersion: source.version, destination: source.destination };
  const captures = await Promise.all(Array.from(new Set(input.scenes.map(s => s.captureId))).map(id => readMedia<Capture>(actor, id)));
  if (captures.some(run => run.payload.recordingScopeVersion !== source.recordingScopeVersion))
    throw new MediaError('A recorded source selection or permission changed. Capture new evidence before creating media.', 409);
  for (const run of captures) {
    const origin = await ownedSession(actor, run.sessionId);
    if (origin.sourceType !== session.sourceType || origin.sourceId !== session.sourceId || origin.canonicalId !== session.canonicalId)
      throw new MediaError('Selected segments belong to another canonical interview.', 403);
  }
  validatePlanSources(plan, captures, actor, source.images.map(image => image.id));
  const row = await createMedia(actor, session.id, 'plan', 'queued', plan);
  await enqueueMedia(actor, row, 'render');
  return { id: row.id, state: row.state };
}
export async function mediaAction(actor: string, raw: unknown) {
  const input = z.object({ id: boundedId, action: z.enum(['approve', 'publish', 'withdraw', 'cancel', 'retry']), expectedVersion: z.number().int().positive() }).parse(raw);
  const row = await readMedia<EditPlan>(actor, input.id);
  if (row.kind !== 'plan') throw new MediaError('Media piece not found.', 404);
  if (!['withdraw', 'cancel'].includes(input.action)) await mediaEligibility(actor, row, 'preview');
  if (['approve', 'publish', 'retry'].includes(input.action) && process.env.FOLIO_INTERVIEW_MEDIA_EXPORTS !== '1') throw new MediaError('Media exports are not enabled.', 404);
  if (input.action === 'publish') {
    await resolveMediaSource(actor, row.payload.source, 'export');
    if (!row.payload.approval || row.payload.approval.digest !== planDigest(row.payload)) throw new MediaError('Approve this exact piece before publication.', 409);
  }
  const changed = await mutateMedia<EditPlan>(actor, row.id, draft => {
    if (['approve', 'publish'].includes(input.action) && (!draft.payload.output || draft.payload.output.digest !== planDigest(draft.payload)))
      throw new MediaError('Wait for the playable preview before approving.', 409);
    if (input.action === 'approve') draft.payload.approval = { actorId: actor, digest: planDigest(draft.payload), at: new Date().toISOString() };
    if (input.action === 'publish') { draft.payload.publishedAt = new Date().toISOString(); draft.state = 'published'; }
    if (input.action === 'withdraw') { delete draft.payload.publishedAt; delete draft.payload.approval; draft.state = 'ready'; }
    if (input.action === 'cancel') draft.state = 'cancelled';
    if (input.action === 'retry') { draft.state = 'queued'; delete draft.payload.error; }
  }, input.expectedVersion);
  if (input.action === 'cancel' || input.action === 'withdraw') await cancelMediaJobs(actor, row.id);
  if (input.action === 'retry') await enqueueMedia(actor, changed, 'render');
  return { id: changed.id, state: changed.state, version: changed.version };
}
export async function mediaPlayback(actor: string, id: string, purpose: 'preview' | 'export') {
  const row = await readMedia<Capture | EditPlan>(actor, id);
  if (row.kind === 'capture') {
    if (purpose !== 'preview') throw new MediaError('Raw interview recordings remain private.', 403);
    await ownedSession(actor, row.sessionId);
    const capture = row.payload as Capture;
    if (row.state !== 'ready' || !capture.key) throw new MediaError('Recording is not ready for playback.', 409);
    assertStorageKey(capture.key, row.sessionId, row.id);
    return { url: await signedPrivate(capture.key), mimeType: capture.hasVideo ? 'video/mp4' : 'audio/mp4' };
  }
  if (purpose === 'export' && process.env.FOLIO_INTERVIEW_MEDIA_EXPORTS !== '1') throw new MediaError('Media exports are not enabled.', 404);
  await mediaEligibility(actor, row as MediaRecord<EditPlan>, purpose);
  const output = (row.payload as EditPlan).output;
  if (!output) throw new MediaError('The rendered piece is not ready.', 409);
  const key = purpose === 'export' ? output.key : output.previewKey;
  assertStorageKey(key, row.sessionId, row.id);
  return { url: await signedPrivate(key, 60), mimeType: output.mimeType };
}
export async function publicMediaPiece(id: string) {
  const row = await publishedMedia(id) as MediaRecord<EditPlan> | null;
  if (!row) throw new MediaError('This media piece is unavailable.', 404);
  await mediaEligibility(row.actorId, row, 'export');
  const output = row.payload.output!;
  assertStorageKey(output.key, row.sessionId, row.id);
  return { title: row.payload.title, description: row.payload.description, credits: row.payload.credits,
    destination: row.payload.destination, url: await signedPrivate(output.key, 60), mimeType: output.mimeType };
}
