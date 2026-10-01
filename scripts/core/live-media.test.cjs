// Disposable PostgreSQL + real FFmpeg integration. Synthetic media, mocked source
// authorization/transcription/storage. No production database or paid API calls.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const vm = require('node:vm');
const ts = require('typescript');
const crypto = require('node:crypto');
const types = require('../../src/lib/interview-media/types');
const planRules = require('../../src/lib/interview-media/plan');
const renderer = require('../../src/lib/interview-media/render');
function load(file, mocks, globals = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText,
    { exports, require: name => { if (name in mocks) return mocks[name]; if (name.startsWith('node:') || name === 'zod' || name === 'crypto') return require(name); throw Error(`Unmocked: ${name}`); },
      console, structuredClone, process, Buffer, Date, JSON, setInterval, clearInterval, AbortController, ...globals }, { filename: file });
  return exports;
}
test('edit validation preserves exact creator speech, caption boundaries and approval identity', () => {
  const spans = [{ order: 0, startMs: 0, endMs: 2000, text: 'Fixture words.', speaker: 'creator', speakerId: 'owner' }];
  const capture = { id: 'capture', actorId: 'owner', version: 1, state: 'ready', payload: { key: 'private', source: { sourceType: 'designer_bio', sourceId: 'owner' }, durationMs: 2000, hasVideo: true, speakerId: 'owner', transcript: spans } };
  const edit = { title: 'Fixture', source: capture.payload.source, format: 'short', scenes: [{ captureId: 'capture', captureVersion: 1, speakerId: 'owner', startMs: 0, endMs: 2000, captionOrders: [0] }] };
  assert.equal(planRules.validatePlanSources(edit, [capture], 'owner', []), 2000);
  const altered = structuredClone(edit); altered.scenes[0].endMs = 1900;
  assert.throws(() => planRules.validatePlanSources(altered, [capture], 'owner', []), /boundaries/);
  const ai = structuredClone(capture); ai.payload.transcript[0].speaker = 'ai';
  assert.throws(() => planRules.validatePlanSources(edit, [ai], 'owner', []), /boundaries/);
  assert.throws(() => planRules.validatePlanSources(edit, [], 'owner', []), /recording/);
  assert.equal(planRules.suggestedMoments(spans)[0].quoteText, 'Fixture words.');
  assert.notEqual(planRules.planDigest(edit), planRules.planDigest({ ...edit, title: 'Changed title' }));
});

test('durable private recording, leased worker, actual short/episode/audio, approval and revoked delivery', { timeout: 240000 }, async () => {
  const { PGlite } = await import('@electric-sql/pglite');
  const pg = new PGlite();
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'folio-live-media-test-'));
  try {
    await renderer.nativeCommand('ffmpeg', ['-version'], dir);
    await renderer.nativeCommand('ffprobe', ['-version'], dir);
    await pg.exec("CREATE ROLE anon; CREATE ROLE authenticated; CREATE TABLE users(id text PRIMARY KEY,role text); INSERT INTO users VALUES ('owner','DESIGNER'),('other','DESIGNER');");
    const migration = fs.readFileSync('prisma/migrations/20261001120000_live_interview_private_media/migration.sql', 'utf8');
    await pg.exec(migration); await pg.exec(migration);
    let serial = Promise.resolve();
    const sql = (strings, values) => [strings.reduce((out, s, i) => out + (i ? '$' + i : '') + s, ''), values];
    const db = {
      $queryRaw: async (strings, ...values) => (await pg.query(...sql(strings, values))).rows,
      $executeRaw: async (strings, ...values) => (await pg.query(...sql(strings, values))).affectedRows,
    };
    db.$transaction = work => { const op = serial.then(async () => { await pg.exec('BEGIN'); try { const value = await work(db); await pg.exec('COMMIT'); return value; } catch (e) { await pg.exec('ROLLBACK'); throw e; } }); serial = op.catch(() => {}); return op; };
    const live = load('src/lib/live-interview/store.ts', { 'server-only': {}, '@/lib/prisma': { prisma: db }, '@/lib/permissions': { normalizeRole: role => role.toUpperCase() } });
    const store = load('src/lib/interview-media/store.ts', { 'server-only': {}, '@/lib/prisma': { prisma: db }, '@/lib/live-interview/store': live, './types': types });
    const request = { id: crypto.randomUUID(), actorId: 'owner', sourceType: 'designer_bio', sourceId: 'owner', canonicalId: 'owner', status: 'active', credentialHash: 'hash1', expiresAt: new Date(Date.now() + 600000), providerIds: {},
      payload: { startRequestId: 'start-one', consent: { mode: 'none', version: '2026-10-01', at: new Date().toISOString(), disclosure: 'Synthetic fixture recording' }, snapshot: { sourceRefs: [{ kind: 'answer', id: 'q1', version: '1' }] } } };
    const reservation = await live.createLiveSession(request, { maxActive: 2, maxDailyActor: 5 });
    assert.equal(reservation.created, true);
    assert.equal((await live.createLiveSession({ ...request, id: crypto.randomUUID() }, { maxActive: 2, maxDailyActor: 5 })).created, false);
    await assert.rejects(live.createLiveSession({ ...request, id: crypto.randomUUID(), actorId: 'other', payload: {} }, { maxActive: 2, maxDailyActor: 5 }), /Another contributor/);
    const objects = new Map(); let version = 'source-v1', scope = 'selection-v1', published = false, imageBytes;
    const adapter = { resolveMediaSource: async (actor, source, purpose) => {
      if (actor !== 'owner' || source.sourceId !== 'owner') throw new types.MediaError('Unauthorized source.', 403);
      if (purpose === 'export' && !published) throw new types.MediaError('Publish the real Folio source.', 403);
      return { version, recordingScopeVersion: scope, destination: '/profile/owner', speakerName: 'Fixture creator', images: [{ id: 'photo', url: 'https://fixture.invalid/rights-cleared-photo.png' }] };
    } };
    const storageApi = { getBucket: async () => ({ data: { public: false, file_size_limit: 512 * 1024 * 1024 }, error: null }), from: () => ({
      createSignedUploadUrl: async key => ({ data: { path: key, token: 'fixture', signedUrl: `https://fixture.invalid/${key}` }, error: null }),
      info: async key => ({ data: objects.has(key) ? { size: objects.get(key).bytes.length, contentType: objects.get(key).mime } : null, error: null }),
      createSignedUrl: async key => ({ data: { signedUrl: `https://fixture.invalid/${key}` }, error: null }),
      upload: async (key, bytes, options) => { assert.equal(options.upsert, false); if (objects.has(key)) return { error: Error('exists') }; objects.set(key, { bytes: Buffer.from(bytes), mime: options.contentType }); return { error: null }; },
      remove: async keys => { keys.forEach(k => objects.delete(k)); return { error: null }; },
    }) };
    const supabase = { supabaseAdmin: { storage: storageApi } };
    const storage = load('src/lib/interview-media/storage.ts', { 'server-only': {}, '@/lib/supabaseAdmin': supabase, '@/lib/interviews/media': { mediaBucket: () => 'interview-media' }, './types': types });
    const service = load('src/lib/interview-media/service.ts', { 'server-only': {}, '@/lib/live-interview/store': live, '@/lib/live-interview/adapters': adapter, './store': store, './storage': storage, './plan': planRules, './types': types });
    process.env.FOLIO_INTERVIEW_RECORDING = '1'; process.env.FOLIO_INTERVIEW_MEDIA_EXPORTS = '1';
    await assert.rejects(service.captureAction('owner', { action: 'start', sessionId: request.id, mimeType: 'video/webm', offsetMs: 0 }), /consent/);
    await live.mutateLiveSession(request.id, row => { row.payload.consent.mode = 'audio'; });
    await assert.rejects(service.captureAction('owner', { action: 'start', sessionId: request.id, mimeType: 'video/webm', offsetMs: 0 }), /Camera/);
    await live.mutateLiveSession(request.id, row => { row.payload.consent.mode = 'video'; });
    const { runId } = await service.captureAction('owner', { action: 'start', sessionId: request.id, mimeType: 'video/webm', offsetMs: 9000 });
    await renderer.nativeCommand('ffmpeg', [...renderer.encodeBase, '-f', 'lavfi', '-i', 'color=c=0x8B8178:s=320x180:d=2', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=2', '-c:v', 'libvpx', '-c:a', 'libopus', '-shortest', 'fixture.webm'], dir);
    const bytes = await fsp.readFile(path.join(dir, 'fixture.webm'));
    await renderer.nativeCommand('ffmpeg', [...renderer.encodeBase, '-i', 'fixture.webm', '-frames:v', '1', 'photo.png'], dir);
    imageBytes = await fsp.readFile(path.join(dir, 'photo.png'));
    await assert.rejects(renderer.normalizeCapture(path.join(dir, 'fixture.webm'), path.join(dir, 'forbidden-camera.mp4'), false, dir), /voice-only/);
    const half = Math.floor(bytes.length / 2);
    await assert.rejects(service.captureAction('other', { action: 'chunk', runId, index: 0, bytes: half }), /not found/);
    await assert.rejects(service.captureAction('owner', { action: 'chunk', runId, index: 1, bytes: half }), /in order/);
    for (const [index, chunk] of [bytes.subarray(0, half), bytes.subarray(half)].entries()) {
      const upload = await service.captureAction('owner', { action: 'chunk', runId, index, bytes: chunk.length });
      await assert.rejects(service.captureAction('owner', { action: 'ack', runId, index }), /missing/);
      objects.set(upload.path, { bytes: chunk, mime: 'video/webm' });
      await service.captureAction('owner', { action: 'ack', runId, index });
    }
    await assert.rejects(service.captureAction('owner', { action: 'finalize', runId, chunkCount: 3, durationMs: 2000 }), /every recording chunk/);
    await service.captureAction('owner', { action: 'finalize', runId, chunkCount: 2, durationMs: 2000 });
    await service.captureAction('owner', { action: 'finalize', runId, chunkCount: 2, durationMs: 2000 });
    const finalizedVersion = (await store.readMedia('owner', runId)).version;
    await service.captureAction('owner', { action: 'ack', runId, index: 1 });
    assert.equal((await store.readMedia('owner', runId)).version, finalizedVersion, 'late acknowledgement never invalidates a queued finalization');
    await store.mutateMedia('owner', runId, () => {});
    assert.equal((await store.readMedia('owner', runId)).version, finalizedVersion, 'unchanged transaction callbacks do not invent a new source version');
    const worker = load('src/lib/interview-media/worker.ts', { 'server-only': {}, '@/lib/supabaseAdmin': supabase, '@/lib/interviews/media': { mediaBucket: () => 'interview-media' },
      '@/lib/interviews/providers': { transcribeRecording: async () => ({ segments: [{ start: 0, end: 1, text: 'Synthetic fixture caption.' }, { start: 1, end: 2, text: 'Second fixture phrase.' }] }) },
      '@/lib/live-interview/adapters': adapter, '@/lib/live-interview/store': live, '@/lib/server/safe-product-url': { safeProductResource: async url => { assert.equal(url, 'https://fixture.invalid/rights-cleared-photo.png'); return { status: 200, headers: { 'content-type': 'image/png' }, body: imageBytes }; } },
      sharp: require('sharp'), './store': store, './storage': storage, './service': service, './plan': planRules, './render': renderer, './types': types,
    }, { fetch: async url => { const key = new URL(url).pathname.slice(1); const data = objects.get(key); return data ? new Response(data.bytes, { headers: { 'content-length': String(data.bytes.length) } }) : new Response(null, { status: 404 }); } });
    assert.equal(await worker.processOneMediaJob(), true);
    const capture = await store.readMedia('owner', runId);
    assert.equal(capture.state, 'ready', JSON.stringify(capture.payload)); assert.equal(capture.payload.offsetMs, 9000); assert.equal(capture.payload.transcript[0].startMs, 0);
    assert.ok(capture.payload.rawTranscript); assert.ok(capture.payload.evidence.sourceRefs.length);
    assert.equal(await worker.processOneMediaJob(), false, 'duplicate finalize queues only one job');
    assert.ok((await service.mediaPlayback('owner', runId, 'preview')).url);
    await assert.rejects(service.mediaPlayback('owner', runId, 'export'), /remain private/);
    const scene = { captureId: runId, captureVersion: capture.version, startMs: 0, endMs: 2000, speakerId: 'owner', focalX: 0.5, focalY: 0.5, transition: 'cut', captionOrders: [0, 1], chapter: 'Fixture chapter' };
    const plans = [];
    for (const format of ['short', 'episode', 'audio']) {
      const plan = await service.createPlan('owner', { sessionId: request.id, title: 'SYNTHETIC FIXTURE', description: 'Test artifact', credits: 'Generated test tone and color', format, aspect: format === 'short' ? 'portrait' : 'landscape', scenes: format === 'episode' ? [scene, scene] : [{ ...scene, ...(format === 'short' ? { imageId: 'photo' } : {}) }] });
      await worker.processOneMediaJob();
      const ready = await store.readMedia('owner', plan.id); assert.equal(ready.state, 'ready', JSON.stringify(ready.payload));
      const out = ready.payload.output; assert.ok(objects.get(out.key).bytes.length > 1000); assert.notEqual(out.previewKey, out.key);
      await fsp.writeFile(path.join(dir, `${format}.mp4`), objects.get(out.key).bytes);
      const info = await renderer.probeMedia(`${format}.mp4`, dir, format !== 'audio');
      assert.ok(info.durationMs >= (format === 'episode' ? 3900 : 1900));
      await assert.rejects(service.mediaPlayback('owner', ready.id, 'export'), /Publish/);
      plans.push(ready);
    }
    published = true;
    let target = plans[0];
    await assert.rejects(service.mediaAction('owner', { id: target.id, action: 'publish', expectedVersion: target.version }), /Approve/);
    await service.mediaAction('owner', { id: target.id, action: 'approve', expectedVersion: target.version });
    target = await store.readMedia('owner', target.id);
    await service.mediaAction('owner', { id: target.id, action: 'publish', expectedVersion: target.version });
    assert.ok((await service.publicMediaPiece(target.id)).url);
    assert.ok((await service.mediaPlayback('owner', target.id, 'export')).url);
    version = 'source-corrected';
    await assert.rejects(service.mediaPlayback('owner', target.id, 'export'), /source changed/);
    await assert.rejects(service.publicMediaPiece(target.id), /source changed/);
    target = await store.readMedia('owner', target.id);
    await service.mediaAction('owner', { id: target.id, action: 'withdraw', expectedVersion: target.version });
    await assert.rejects(service.publicMediaPiece(target.id), /unavailable/);
    scope = 'selection-v2';
    await assert.rejects(service.createPlan('owner', { sessionId: request.id, title: 'Cannot reuse deselected footage', format: 'audio', aspect: 'landscape', scenes: [scene] }), /source selection or permission changed/);
    const abandoned = await store.createMedia('owner', request.id, 'capture', 'processing', capture.payload);
    await store.enqueueMedia('owner', abandoned, 'finalize');
    const claimed = await store.claimMediaJob();
    await pg.query('UPDATE interview_media_records SET attempts=3,"leaseUntil"=now()-interval \'1 minute\' WHERE id=$1', [claimed.id]);
    await store.claimMediaJob();
    assert.equal((await store.readMedia('owner', abandoned.id)).state, 'failed', 'three crashed leases visibly fail the target');
    await service.captureAction('owner', { action: 'retry', runId: abandoned.id });
    const retryClaim = await store.claimMediaJob();
    assert.equal(retryClaim.attempts, 1, 'explicit retry has a fresh bounded job');
    await store.cancelMediaJobs('owner', abandoned.id);
    await assert.rejects(store.completeMediaTarget(retryClaim, capture.payload), /cancelled|expired/);
    await assert.rejects(store.mutateMedia('other', abandoned.id, row => { row.state = 'ready'; }), /not found/);
    assert.equal((await live.getLiveSession(request.id)).payload.consent.mode, 'video', 'media operations preserve saved interview state');
    await live.mutateLiveSession(request.id, row => { row.status = 'ended'; });
    const roundTwo = await live.createLiveSession({ ...request, id: crypto.randomUUID(), credentialHash: 'round2-hash', status: 'ended',
      payload: { ...request.payload, startRequestId: 'round-two', source: { kind: 'designer_bio', id: 'owner', round: 2 } } }, { maxActive: 2, maxDailyActor: 5 });
    assert.equal((await live.getLatestLiveSession('owner', 'designer_bio', 'owner', undefined, 1)).id, request.id);
    assert.equal((await live.getLatestLiveSession('owner', 'designer_bio', 'owner', undefined, 2)).id, roundTwo.session.id);
    assert.equal(await live.getLatestLiveSession('owner', 'designer_bio', 'owner', roundTwo.session.id, 2), null);
    console.log('PASS actual FFmpeg files: portrait short, chaptered landscape episode, audio-only, private marked previews; PostgreSQL and mocked external boundaries.');
  } finally { await pg.close(); await fsp.rm(dir, { recursive: true, force: true }); }
});
