import 'server-only';
import { mkdtemp, rm, open, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { File } from 'node:buffer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { mediaBucket } from '@/lib/interviews/media';
import { transcribeRecording } from '@/lib/interviews/providers';
import { resolveMediaSource } from '@/lib/live-interview/adapters';
import { getLiveSession } from '@/lib/live-interview/store';
import { safeProductResource } from '@/lib/server/safe-product-url';
import { claimMediaJob, readMedia, renewMediaJob, finishMediaJob, completeMediaTarget, failMediaTarget } from './store';
import { storageKey, assertStorageKey, signedPrivate, inspectChunk } from './storage';
import { mediaEligibility } from './service';
import { planDigest, suggestedMoments } from './plan';
import { boundedFile, nativeCommand, normalizeCapture, renderEditPlan, encodeBase } from './render';
import { MediaError, MAX_CAPTURE_BYTES } from './types';
import type { Capture, EditPlan, MediaRecord, MediaJob, AlignedSegment } from './types';

async function downloadObject(key: string, file: string, max: number, signal: AbortSignal, append = false) {
  const response = await fetch(await signedPrivate(key, 300), { signal, redirect: 'error' });
  if (!response.ok || !response.body || Number(response.headers.get('content-length') || 0) > max) throw new MediaError('Private source download failed.');
  const handle = await open(file, append ? 'a' : 'w');
  let bytes = 0;
  try {
    for await (const chunk of response.body as unknown as AsyncIterable<Uint8Array>) {
      bytes += chunk.length;
      if (bytes > max) throw new MediaError('The source exceeds its reserved size.');
      await handle.write(chunk);
    }
  } finally { await handle.close(); }
  return bytes;
}
async function uploadOutput(file: string, key: string, mime: string) {
  const bucket = await supabaseAdmin.storage.getBucket(mediaBucket());
  if (bucket.error || !bucket.data || bucket.data.public) throw new MediaError('Private storage is unavailable.');
  const max = Math.min(MAX_CAPTURE_BYTES, Number(bucket.data.file_size_limit) || MAX_CAPTURE_BYTES);
  const { error } = await supabaseAdmin.storage.from(mediaBucket()).upload(key, await boundedFile(file, max), { contentType: mime, upsert: false });
  if (error) throw new MediaError('The private output upload failed.');
}
async function alignCapture(file: string, durationMs: number, actor: string, cwd: string, signal: AbortSignal) {
  const transcript: AlignedSegment[] = [], rawTranscript: unknown[] = [];
  // Whisper timestamps are segment-level. Split actual stored media under provider upload limits.
  for (let offset = 0; offset < durationMs; offset += 8 * 60 * 1000) {
    const part = join(cwd, 'transcribe.mp3');
    await nativeCommand('ffmpeg', [...encodeBase, '-ss', String(offset / 1000), '-t', '480', '-i', file, '-vn', '-ar', '16000', '-ac', '1', '-b:a', '64k', part], cwd, signal);
    const result = await transcribeRecording(new File([await boundedFile(part, 24 * 1024 * 1024)], 'capture.mp3', { type: 'audio/mpeg' }) as unknown as globalThis.File);
    rawTranscript.push({ offsetMs: offset, result });
    for (const segment of result.segments || []) {
      const startMs = offset + Math.round(segment.start * 1000), endMs = Math.min(durationMs, offset + Math.round(segment.end * 1000));
      if (segment.text?.trim() && startMs >= 0 && endMs > startMs && (!transcript.length || startMs >= transcript.at(-1)!.startMs))
        transcript.push({ order: transcript.length, startMs, endMs, text: segment.text.trim(), speaker: 'creator', speakerId: actor });
    }
  }
  if (!transcript.length) throw new MediaError('No recording-aligned speech was found. The original source is preserved privately.');
  return { transcript, rawTranscript };
}
async function finalizeCapture(job: MediaRecord<MediaJob>, cwd: string, signal: AbortSignal, uploaded: string[]) {
  const run = await readMedia<Capture>(job.actorId, job.payload.targetId);
  if (run.version !== job.payload.targetVersion || run.state !== 'processing') throw new MediaError('The recording changed.', 409);
  await resolveMediaSource(job.actorId, run.payload.source, 'preview');
  const input = join(cwd, run.payload.mimeType.includes('webm') ? 'capture.webm' : 'capture.mp4');
  if (!run.payload.chunks.length || run.payload.chunks.some((chunk, index) => !chunk.uploaded || chunk.index !== index)) throw new MediaError('The recorder manifest is incomplete.');
  // Byte assembly is only within this one uninterrupted MediaRecorder container.
  // Separate recorder runs are normalized independently and never byte-concatenated.
  let size = 0;
  for (const chunk of run.payload.chunks) {
    assertStorageKey(chunk.key, run.sessionId, run.id);
    await inspectChunk(chunk.key, chunk.bytes, run.payload.mimeType);
    size += await downloadObject(chunk.key, input, chunk.bytes, signal, true);
    if (size > MAX_CAPTURE_BYTES) throw new MediaError('Recording size limit exceeded.');
  }
  const output = join(cwd, 'source.mp4');
  const info = await normalizeCapture(input, output, run.payload.mimeType.startsWith('video/'), cwd, signal);
  if (info.hasVideo && run.payload.consent.mode !== 'video') throw new MediaError('Video capture was not consented.');
  if (info.durationMs > 60 * 60 * 1000 || Math.abs(info.durationMs - run.payload.durationMs) > Math.max(5000, run.payload.durationMs * 0.15))
    throw new MediaError('The recording duration does not match its manifest.');
  const aligned = await alignCapture(output, info.durationMs, job.actorId, cwd, signal);
  const current = await resolveMediaSource(job.actorId, run.payload.source, 'preview');
  if (current.recordingScopeVersion !== run.payload.recordingScopeVersion)
    throw new MediaError('The recording source selection or permission changed during capture.', 409);
  const key = storageKey(run.sessionId, run.id, `source-${job.leaseToken}.mp4`);
  await uploadOutput(output, key, info.hasVideo ? 'video/mp4' : 'audio/mp4'); uploaded.push(key);
  const session = await getLiveSession(run.sessionId);
  await completeMediaTarget(job, { ...run.payload, ...info, ...aligned, sourceVersion: current.version, key, moments: suggestedMoments(aligned.transcript),
    evidence: { sourceRefs: session?.payload.snapshot?.sourceRefs || [], turns: session?.payload.turnState?.turns || [],
      note: 'Canonical evidence references at finalization. No speech timestamp is inferred from provider events or receipt times.' } });
}
async function renderPlan(job: MediaRecord<MediaJob>, cwd: string, signal: AbortSignal, uploaded: string[]) {
  const plan = await readMedia<EditPlan>(job.actorId, job.payload.targetId);
  if (plan.version !== job.payload.targetVersion || plan.state !== 'queued') throw new MediaError('The edit plan changed.', 409);
  const { current, captures } = await mediaEligibility(job.actorId, plan, 'preview');
  const files = new Map<string, string>(), images = new Map<string, string>();
  for (const [index, capture] of Array.from(captures.entries())) {
    assertStorageKey(capture.payload.key!, capture.sessionId, capture.id);
    const file = join(cwd, `source${index}.mp4`);
    await downloadObject(capture.payload.key!, file, MAX_CAPTURE_BYTES, signal); files.set(capture.id, file);
  }
  for (const id of Array.from(new Set(plan.payload.scenes.flatMap(s => s.imageId ? [s.imageId] : [])))) {
    const source = current.images.find(image => image.id === id);
    if (!source) throw new MediaError('The photograph is no longer authorized.', 409);
    // Reuse DNS-pinned, bounded server fetch. Never accept image URLs from an edit plan.
    const response = await safeProductResource(source.url);
    if (response.status !== 200 || !response.headers['content-type']?.startsWith('image/')) throw new MediaError('The authorized photograph could not be loaded.');
    const file = join(cwd, `image${images.size}.jpg`);
    const sharp = (await import('sharp')).default;
    await writeFile(file, await sharp(response.body, { limitInputPixels: 40_000_000 }).rotate().resize({ width: 1920, height: 1920, fit: 'inside', withoutEnlargement: true }).jpeg().toBuffer());
    images.set(id, file);
  }
  const rendered = await renderEditPlan(plan.payload, captures, files, images, cwd, signal);
  // Check again after native processing. Revoked sources never become available outputs.
  await mediaEligibility(job.actorId, plan, 'preview');
  const key = storageKey(plan.sessionId, plan.id, `output-${job.leaseToken}.${plan.payload.format === 'audio' ? 'm4a' : 'mp4'}`);
  const previewKey = storageKey(plan.sessionId, plan.id, `preview-${job.leaseToken}.${plan.payload.format === 'audio' ? 'm4a' : 'mp4'}`);
  await uploadOutput(rendered.output, key, rendered.mimeType); uploaded.push(key);
  await uploadOutput(rendered.preview, previewKey, rendered.mimeType); uploaded.push(previewKey);
  await completeMediaTarget(job, { ...plan.payload, output: { key, previewKey, mimeType: rendered.mimeType, durationMs: rendered.durationMs, digest: planDigest(plan.payload) } });
}
export async function processOneMediaJob() {
  const job = await claimMediaJob();
  if (!job) return false;
  const cwd = await mkdtemp(join(tmpdir(), 'folio-media-'));
  const controller = new AbortController(), uploaded: string[] = [];
  let complete = false;
  const heartbeat = setInterval(() => { void renewMediaJob(job).catch(() => controller.abort()); }, 20000);
  try {
    await (job.payload.task === 'finalize' ? finalizeCapture : renderPlan)(job, cwd, controller.signal, uploaded);
    complete = true;
  } catch (error) {
    // Provider diagnostics may contain URLs/tokens. Keep persisted user-facing errors bounded and generic.
    const message = error instanceof MediaError && !error.message.startsWith('Media processing failed') ? error.message : 'Media processing failed. Retry after checking worker configuration.';
    await failMediaTarget(job, message);
    await finishMediaJob(job, message);
  } finally {
    clearInterval(heartbeat);
    controller.abort();
    if (!complete && uploaded.length) await supabaseAdmin.storage.from(mediaBucket()).remove(uploaded);
    // cwd is an owned mkdtemp directory; never interpolate user-provided paths.
    await rm(cwd, { recursive: true, force: true });
  }
  return true;
}
