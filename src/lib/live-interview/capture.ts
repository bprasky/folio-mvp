/** Browser-only creator capture. Remote interviewer tracks are never added. */
export type CaptureMode = 'audio' | 'video';
export type CaptureState = 'recording' | 'uploading' | 'processing' | 'incomplete';
export interface CaptureHandle {
  runId: string;
  stop(): Promise<void>;
  retry(): Promise<void>;
  setMuted(muted: boolean): void;
}
type CaptureProgress = (state: CaptureState, message?: string) => void;
interface QueuedChunk { runId: string; index: number; blob: Blob }
interface CaptureRun {
  runId: string; sessionId: string; mimeType: string; chunkCount: number;
  durationMs: number; stopped: boolean; damaged: boolean; expiresAt: number;
}
const MAX_PENDING_BYTES = 25 * 1024 * 1024;
const MAX_RUN_BYTES = 500 * 1024 * 1024;
const MAX_RUN_MS = 55 * 60 * 1000;
const CAPTURE_ENDPOINT = '/api/interview-media/capture';
const RECOVERY_TTL_MS = 24 * 60 * 60 * 1000;

export function recordingMime(mode: CaptureMode): string {
  if (typeof MediaRecorder === 'undefined') throw new Error('Recording is unavailable in this browser. You can still interview without saving media.');
  const types = mode === 'video'
    ? ['video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4']
    : ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
  const type = types.find(value => MediaRecorder.isTypeSupported(value));
  if (!type) throw new Error('This browser cannot save a supported recording. Choose an interview without recording.');
  return type;
}

function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('folio-private-live-capture', 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('chunks', { keyPath: ['runId', 'index'] });
      request.result.createObjectStore('runs', { keyPath: 'runId' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('Private recording storage is unavailable.'));
  });
}

async function write(store: 'chunks' | 'runs', value: QueuedChunk | CaptureRun | IDBValidKey, remove = false) {
  const db = await database();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(store, 'readwrite');
      if (remove) tx.objectStore(store).delete(value as IDBValidKey);
      else tx.objectStore(store).put(value);
      tx.oncomplete = () => resolve();
      tx.onerror = tx.onabort = () => reject(new Error('This device could not retain the recording chunk.'));
    });
  } finally { db.close(); }
}

async function firstChunk(runId: string): Promise<QueuedChunk | null> {
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const range = IDBKeyRange.bound([runId, 0], [runId, Number.MAX_SAFE_INTEGER]);
      const request = db.transaction('chunks').objectStore('chunks').openCursor(range);
      request.onsuccess = () => resolve(request.result?.value ?? null);
      request.onerror = () => reject(new Error('Could not restore saved recording chunks.'));
    });
  } finally { db.close(); }
}

async function allRuns(): Promise<CaptureRun[]> {
  const db = await database();
  try { return await new Promise((resolve, reject) => {
    const req = db.transaction('runs').objectStore('runs').getAll();
    req.onsuccess = () => resolve(req.result); req.onerror = () => reject(new Error('Local recording recovery is unavailable.'));
  }); } finally { db.close(); }
}
async function deleteLocalRun(runId: string) {
  const db = await database();
  try { await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(['runs','chunks'], 'readwrite');
    tx.objectStore('runs').delete(runId);
    tx.objectStore('chunks').delete(IDBKeyRange.bound([runId,0],[runId,Number.MAX_SAFE_INTEGER]));
    tx.oncomplete=()=>resolve();tx.onerror=tx.onabort=()=>reject(new Error('Local recording deletion failed.'));
  }); } finally { db.close(); }
}
/** Expiry is enforced whenever Folio opens capture/recovery, including abandoned runs. */
export async function purgeExpiredCaptures() {
  for (const run of await allRuns()) if (!run.expiresAt || run.expiresAt <= Date.now()) await deleteLocalRun(run.runId);
}
export async function discardStoredCaptures(sessionId: string) {
  for (const run of (await allRuns()).filter(run=>run.sessionId===sessionId)) {
    await request({action:'incomplete',runId:run.runId,error:'creator_discarded_device_recovery'});
    await deleteLocalRun(run.runId);
  }
}
async function request<T>(body: Record<string, unknown>): Promise<T> {
  const response = await fetch(CAPTURE_ENDPOINT, { method: 'POST', credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(30_000) });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof result.error === 'string' ? result.error : 'Recording upload could not finish. Your retained chunks can be retried.');
  return result as T;
}

async function upload(run: CaptureRun, chunk: QueuedChunk) {
  // A prior PUT may have succeeded despite a lost response. Verify first, never overwrite.
  const acknowledged = await request({ action: 'ack', runId: run.runId, index: chunk.index }).then(() => true, () => false);
  if (!acknowledged) {
    const signed = await request<{ signedUrl: string }>({ action: 'chunk', runId: run.runId, index: chunk.index, bytes: chunk.blob.size });
    try {
      const response = await fetch(signed.signedUrl, { method: 'PUT', body: chunk.blob,
        headers: { 'Content-Type': run.mimeType }, signal: AbortSignal.timeout(45_000) });
      if (!response.ok) throw new Error('Recording chunk upload was interrupted.');
    } catch {
      // Authenticate object existence through Folio after an ambiguous storage write.
      await request({ action: 'ack', runId: run.runId, index: chunk.index });
      return;
    }
    await request({ action: 'ack', runId: run.runId, index: chunk.index });
  }
}

/** Test private local storage before creating a paid conversation. No microphone is opened here. */
export async function checkCaptureReady(mode: CaptureMode): Promise<string> {
  const mimeType = recordingMime(mode);
  await purgeExpiredCaptures();
  const db = await database();
  const pending = await new Promise<number>((resolve, reject) => {
    const req=db.transaction('chunks').objectStore('chunks').getAll();
    req.onsuccess=()=>resolve(req.result.reduce((total:number,chunk:QueuedChunk)=>total+chunk.blob.size,0));
    req.onerror=()=>reject(new Error('Local recording recovery is unavailable.'));
  }).finally(()=>db.close());
  if(pending>=MAX_PENDING_BYTES)throw new Error('Retry or discard previous device recording recovery before starting another recording.');
  const estimate = await navigator.storage?.estimate?.();
  if (estimate?.quota && estimate.quota - (estimate.usage || 0) < MAX_PENDING_BYTES)
    throw new Error('This device needs more free storage before recording. You can interview without saving media.');
  return mimeType;
}

export async function startCreatorCapture(options: {
  sessionId: string; stream: MediaStream; mode: CaptureMode; offsetMs: number; onProgress: CaptureProgress; initiallyMuted?: boolean;
}): Promise<CaptureHandle> {
  const mimeType = await checkCaptureReady(options.mode);
  const selected = options.mode === 'audio' ? options.stream.getAudioTracks() : options.stream.getTracks();
  if (!selected.some(track => track.kind === 'audio' && track.readyState === 'live')) throw new Error('A working microphone is required for recording.');
  if (options.mode === 'video' && !selected.some(track => track.kind === 'video' && track.readyState === 'live')) throw new Error('Camera permission is required for voice and camera recording.');
  const reservation = await request<{ runId: string; maxChunkBytes: number }>({ action: 'start', sessionId: options.sessionId, mimeType, offsetMs: Math.max(0, Math.round(options.offsetMs)) });
  const stream = new MediaStream(selected.map(track => { const clone = track.clone(); clone.enabled = track.enabled && !(track.kind==='audio' && options.initiallyMuted); return clone; }));
  const run: CaptureRun = { runId: reservation.runId, sessionId: options.sessionId, mimeType, chunkCount: 0, durationMs: 0, stopped: false, damaged: false, expiresAt: Date.now()+RECOVERY_TTL_MS };
  let recorder: MediaRecorder;
  try {
    await write('runs', run);
    recorder = new MediaRecorder(stream, { mimeType, audioBitsPerSecond: 96_000, ...(options.mode === 'video' ? { videoBitsPerSecond: 800_000 } : {}) });
  } catch (error) {
    stream.getTracks().forEach(track => track.stop());
    void request({ action: 'incomplete', runId: run.runId, error: 'capture_start_failed' }).catch(() => {});
    throw error;
  }
  const startedAt = performance.now();
  let pendingBytes = 0; let totalBytes = 0; let blocked = false;
  let enqueuing = Promise.resolve(); let pumping: Promise<void> | null = null;
  let finalizing: Promise<void> | null = null;
  let resolveStopped!: () => void;
  const stopped = new Promise<void>(resolve => { resolveStopped = resolve; });
  const stopTracks = () => stream.getTracks().forEach(track => track.stop());
  const stopRecorder = () => {
    if (recorder.state !== 'inactive') recorder.stop();
  };
  const reportFailure = (message: string) => {
    blocked = true; stopRecorder();
    options.onProgress('incomplete', message);
  };
  const pump = (): Promise<void> => {
    if (pumping) return pumping;
    pumping = (async () => {
      while (!blocked) {
        const chunk = await firstChunk(run.runId);
        if (!chunk) break;
        await upload(run, chunk);
        await write('chunks', [run.runId, chunk.index], true);
        pendingBytes = Math.max(0, pendingBytes - chunk.blob.size);
      }
    })().catch(() => {
      reportFailure('Recording stopped because upload was interrupted. Keep this page open and retry the saved chunks.');
    }).finally(() => { pumping = null; });
    return pumping;
  };
  const finish = async () => {
    await stopped; await enqueuing;
    if (blocked) throw new Error('Recording upload needs attention. Retry before leaving this page.');
    options.onProgress('uploading'); await pump();
    if (blocked) throw new Error('Recording upload needs attention. Retry before leaving this page.');
    if (run.damaged || !run.chunkCount) {
      await request({ action: 'incomplete', runId: run.runId, error: 'incomplete_capture' });
      options.onProgress('incomplete', 'The recording is incomplete. Saved source chunks remain private; it is unavailable for media export.');
      return;
    }
    await request({ action: 'finalize', runId: run.runId, chunkCount: run.chunkCount, durationMs: run.durationMs });
    await write('runs', run.runId, true);
    options.onProgress('processing', 'Saved privately. Playability and transcription are being checked.');
  };
  const finalizeOnce = () => finalizing ??= finish().finally(() => { finalizing = null; });
  recorder.ondataavailable = event => {
    if (!event.data.size) return;
    pendingBytes += event.data.size; totalBytes += event.data.size;
    // Stop producing before queued work grows without bound. Already produced bytes are retained.
    if (pendingBytes >= MAX_PENDING_BYTES || totalBytes >= MAX_RUN_BYTES) {
      stopRecorder(); options.onProgress('uploading', 'Recording stopped at the upload limit. Finishing saved chunks.');
    }
    enqueuing = enqueuing.then(async () => {
      for (let offset = 0; offset < event.data.size; offset += reservation.maxChunkBytes) {
        const chunk: QueuedChunk = { runId: run.runId, index: run.chunkCount, blob: event.data.slice(offset, offset + reservation.maxChunkBytes, mimeType) };
        await write('chunks', chunk); run.chunkCount++; await write('runs', run);
      }
      void pump();
    }).catch(() => {
      run.damaged = true;
      reportFailure('Recording stopped because device storage failed. Uploaded material is retained, but this source requires review.');
    });
  };
  recorder.onerror = () => { run.damaged = true; reportFailure('Recording was interrupted by this device. Saved source material is retained privately.'); };
  const timer = window.setTimeout(stopRecorder, MAX_RUN_MS);
  recorder.onstop = () => {
    window.clearTimeout(timer); run.durationMs = Math.round(performance.now() - startedAt); run.stopped = true; stopTracks();
    enqueuing = enqueuing.then(() => write('runs', run)).catch(() => { run.damaged = true; });
    resolveStopped();
    if (!blocked) void finalizeOnce().catch(() => options.onProgress('incomplete', 'The last recording chunks need another upload attempt.'));
  };
  for (const track of stream.getTracks()) track.onended = () => stopRecorder();
  try { recorder.start(5_000); options.onProgress('recording'); }
  catch (error) {
    window.clearTimeout(timer); stopTracks(); run.damaged = true; run.stopped = true; resolveStopped();
    void request({ action: 'incomplete', runId: run.runId, error: 'recorder_start_failed' }).catch(() => {});
    throw error;
  }
  return {
    runId: run.runId,
    stop: () => { stopRecorder(); return finalizeOnce(); },
    retry: async () => { await stopped; await enqueuing; blocked = false; return finalizeOnce(); },
    setMuted: muted => { stream.getAudioTracks().forEach(track => { track.enabled = !muted; }); },
  };
}

/** Restore only this server-authorized session's stopped local queue after a reload. */
export async function retryStoredCaptures(sessionId: string, onProgress: CaptureProgress): Promise<void> {
  await purgeExpiredCaptures();
  const runs = await allRuns();
  for (const run of runs.filter(item => item.sessionId === sessionId)) {
    onProgress('uploading');
    let chunk: QueuedChunk | null;
    while ((chunk = await firstChunk(run.runId))) {
      await upload(run, chunk); await write('chunks', [run.runId, chunk.index], true);
    }
    if (!run.stopped || run.damaged || !run.chunkCount) {
      await request({ action: 'incomplete', runId: run.runId, error: 'browser_interrupted' });
      onProgress('incomplete', 'The browser ended before the final recording chunk. Saved source material is retained privately.');
    } else {
      await request({ action: 'finalize', runId: run.runId, chunkCount: run.chunkCount, durationMs: run.durationMs });
      await write('runs', run.runId, true); onProgress('processing');
    }
  }
}
