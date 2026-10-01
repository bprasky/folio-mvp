// Composed in-process application journey. Real HTTP routes, live adapters,
// guided engine/projection, bio writer, media SQL, worker and FFmpeg renderer.
// Existing Prisma model delegates use the schema-aware orchestration double;
// new session/media/job tables use disposable PGlite. Auth, LLM, Tavus,
// Supabase and recording-aligned ASR are synthetic. No .env or network access.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const vm = require('node:vm');
const { randomUUID } = require('node:crypto');
const ts = require('typescript');
const { Prisma } = require('@prisma/client');
const { memoryDatabase } = require('./core/memory-db.cjs');

const root = path.resolve(__dirname, '..');
const env = {
  NODE_ENV: 'test', DATABASE_URL: 'postgresql://disabled:disabled@127.0.0.1:1/no_network',
  FOLIO_LIVE_INTERVIEWS: '1', FOLIO_LIVE_ALLOWLIST: 'owner,other', FOLIO_INTERVIEW_RECORDING: '1',
  FOLIO_INTERVIEW_MEDIA_EXPORTS: '1', FOLIO_LIVE_BASE_URL: 'https://folio.test',
  NEXTAUTH_SECRET: 'synthetic-journey-session-secret', TAVUS_API_KEY: 'synthetic-tavus-key',
  NEXT_PUBLIC_FLAG_GUIDED_INTERVIEW: '1', ANTHROPIC_ENABLED: 'true', ANTHROPIC_API_KEY: 'synthetic-llm-key',
  SPOTLIGHT_PROJECT_IDS: '', SPOTLIGHT_ACTOR_IDS: '', SPOTLIGHT_INTERVIEW_V1: 'false',
  ...(process.env.FFMPEG_PATH ? { FFMPEG_PATH: process.env.FFMPEG_PATH } : {}),
  ...(process.env.FFPROBE_PATH ? { FFPROBE_PATH: process.env.FFPROBE_PATH } : {}),
};
const database = memoryDatabase();
const cache = new Map(), objects = new Map(), pals = new Map(), conversations = new Map();
let actor = 'owner', providerCreates = 0, sourceText = '', modelCalls = 0;
const questions = [
  ['CLIENT_BRIEF', 'What did the clients come to you wanting from this project?'],
  ['SCOPE_PARAMETERS', 'What were you working within on this project?'],
  ['DESIGN_DIRECTION', 'What was the overall design idea for this project?'],
  ['SIGNATURE_IDENTITY', 'What in this project is most recognizably yours?'],
  ['SURPRISE_PIVOT', 'What discovery changed the direction of this project along the way?'],
];
const modelResponse = value => ({ model: 'synthetic-model', stop_reason: 'end_turn', usage: { input_tokens: 10, output_tokens: 10 }, content: [{ type: 'text', text: JSON.stringify(value) }] });
class SyntheticAnthropic {
  messages = { create: async input => {
    modelCalls++;
    const system = String(input.system || ''), text = JSON.stringify(input.messages);
    if (system.includes('Review a guided preparation batch')) {
      const { candidates } = JSON.parse(input.messages[0].content);
      return modelResponse({ reviews: candidates.map(candidate => ({ id: candidate.id, valid: true, reason: 'Neutral prepared question.', evidence: [] })) });
    }
    if (system.includes('Review a guided interview candidate')) return modelResponse({ valid: true, reason: 'Grounded remaining obligation.' });
    if (system.includes('bounded next-turn proposal')) {
      const context = JSON.parse(input.messages[0].content), accepted = context.currentAnswer;
      const post = await database.projectPost.findUnique({ where: { projectId: 'project' } });
      assert.ok(post.provenance.interview.guided.turns.some(turn => turn.id === accepted.id), 'canonical answer commits before next-question generation');
      assert.ok((await database.editorialInterviewAnswer.findMany()).some(answer => answer.answerText === accepted.text.trim()), 'editable-draft evidence projection commits before next-question generation');
      const next = context.remainingPreparedQuestions?.[0];
      return modelResponse(next ? { kind: 'ask_prepared', questionId: next.id, text: next.text, purpose: 'Ask the next remaining topic.', sourceAnswerIds: [], evidence: [] } : { kind: 'advance' });
    }
    if (text.includes('opening interview questions')) return modelResponse({ questions: questions.map(([category, question]) => ({ category, question })) });
    if (text.includes("interviewer's notebook")) return modelResponse({ direction: 'A room for daily life.' });
    throw Error('Unexpected model request in composed journey');
  } };
}
const storage = {
  getBucket: async () => ({ data: { public: false, file_size_limit: 512 * 1024 * 1024 }, error: null }),
  from: () => ({
    createSignedUploadUrl: async key => ({ data: { path: key, token: 'synthetic', signedUrl: `https://storage.fixture.invalid/${key}` }, error: null }),
    info: async key => ({ data: objects.has(key) ? { size: objects.get(key).bytes.length, contentType: objects.get(key).mime } : null, error: null }),
    createSignedUrl: async key => ({ data: { signedUrl: `https://storage.fixture.invalid/${key}` }, error: null }),
    upload: async (key, bytes, options) => {
      assert.equal(options.upsert, false);
      if (objects.has(key)) return { error: Error('Object already exists') };
      objects.set(key, { bytes: Buffer.from(bytes), mime: options.contentType }); return { error: null };
    },
    remove: async keys => { keys.forEach(key => objects.delete(key)); return { error: null }; },
  }),
};
async function syntheticFetch(url, options = {}) {
  const parsed = new URL(url), body = options.body ? JSON.parse(options.body) : undefined;
  if (parsed.hostname === 'storage.fixture.invalid') {
    const value = objects.get(parsed.pathname.slice(1));
    return value ? new Response(value.bytes, { headers: { 'content-length': String(value.bytes.length) } }) : new Response(null, { status: 404 });
  }
  assert.equal(parsed.origin, 'https://tavusapi.com', 'every external request must use the synthetic provider/storage boundary');
  if (parsed.pathname === '/v2/pals' && options.method === 'POST') {
    const id = randomUUID(); pals.set(id, body); return Response.json({ pal_id: id });
  }
  if (parsed.pathname === '/v2/conversations' && options.method === 'POST') {
    providerCreates++;
    const id = randomUUID(), value = { conversation_id: id, conversation_name: body.conversation_name, conversation_url: 'https://synthetic.daily.co/journey', meeting_token: 'fixture-join', pal_id: body.pal_id, status: 'active' };
    conversations.set(id, value); return Response.json(value);
  }
  const ended = /^\/v2\/conversations\/([^/]+)\/end$/.exec(parsed.pathname);
  if (ended) { conversations.get(ended[1]).status = 'ended'; return new Response(null, { status: 204 }); }
  const found = /^\/v2\/conversations\/([^/]+)$/.exec(parsed.pathname);
  if (found) return Response.json(conversations.get(found[1]));
  const removed = /^\/v2\/pals\/([^/]+)$/.exec(parsed.pathname);
  if (removed && options.method === 'DELETE') { pals.delete(removed[1]); return new Response(null, { status: 204 }); }
  throw Error(`Unexpected synthetic provider operation: ${options.method} ${parsed.pathname}`);
}
const unused = label => new Proxy({}, { get: (_object, name) => {
  if (name === '__esModule') return false;
  return () => { throw Error(`Out-of-scope ${label}.${String(name)} was called; this journey cannot fake native adapters`); };
} });
const mocks = {
  'server-only': {}, '@/lib/prisma': { prisma: database },
  'next-auth': { getServerSession: async () => actor ? { user: { id: actor } } : null },
  '@/app/api/auth/[...nextauth]/options': { authOptions: {} },
  'next/server': { NextRequest: Request, NextResponse: { json: (body, options) => Response.json(body, options) } },
  'next/cache': { revalidatePath: () => {} },
  '@anthropic-ai/sdk': SyntheticAnthropic,
  '@/lib/rateLimit': { checkRateLimit: async () => ({ success: true }) },
  '@/lib/publishing-studio/data': { resolvePublishingStudioContext: async () => ({ id: null }) },
  '@/lib/posting/slug': { makeSlug: () => 'synthetic-journey' },
  '@/lib/supabaseAdmin': { supabaseAdmin: { storage } },
  '@/lib/interviews/media': { mediaBucket: () => 'interview-media' },
  '@/lib/interviews/providers': { transcribeRecording: async () => ({ segments: [{ start: 0, end: 2, text: sourceText }] }) },
  '@/lib/server/safe-product-url': unused('photography-fetch'),
  '@/lib/spotlight/service': unused('spotlight'),
  '@/lib/publishing-studio/expertise/service': unused('expertise'),
  '@/lib/publishing-studio/story-service': unused('story'),
  '@/lib/collaboration/interview-service': unused('collaboration'),
};
function load(file) {
  const full = path.resolve(root, file);
  if (cache.has(full)) return cache.get(full).exports;
  const module = { exports: {} }; cache.set(full, module);
  const code = ts.transpileModule(fs.readFileSync(full, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const localRequire = name => {
    if (name in mocks) return mocks[name];
    const target = name.startsWith('@/') ? path.join(root, 'src', name.slice(2)) : name.startsWith('.') ? path.resolve(path.dirname(full), name) : null;
    if (target) return load(fs.existsSync(target) ? target : target + '.ts');
    return require(name);
  };
  vm.runInNewContext(`(function(require,module,exports){${code}\n})`, {
    process: { env }, console, Buffer, URL, Request, Response, AbortSignal, AbortController,
    structuredClone, Date, setTimeout, clearTimeout, setInterval, clearInterval, fetch: syntheticFetch,
  }, { filename: full })(localRequire, module, module.exports);
  return module.exports;
}
const route = name => load(`src/app/api/${name}/route.ts`);
const request = (url, body) => new Request(`https://folio.test${url}`, { method: 'POST', headers: { origin: 'https://folio.test', 'content-type': 'application/json' }, body: JSON.stringify(body) });
async function json(response, expected = 200) {
  const value = await response.json(); assert.equal(response.status, expected, JSON.stringify(value)); return value;
}
async function main() {
  const { PGlite } = await import('@electric-sql/pglite');
  const pg = new PGlite(), dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'folio-composed-journey-'));
  try {
    await pg.exec("CREATE ROLE anon; CREATE ROLE authenticated; CREATE TABLE users(id text PRIMARY KEY,role text); INSERT INTO users VALUES ('owner','DESIGNER'),('other','DESIGNER');");
    await pg.exec(fs.readFileSync(path.join(root, 'prisma/migrations/20261001120000_live_interview_private_media/migration.sql'), 'utf8'));
    const sql = (strings, values) => [strings.reduce((out, text, index) => out + (index ? '$' + index : '') + text, ''), values];
    database.$queryRaw = async (strings, ...values) => (await pg.query(...sql(strings, values))).rows;
    database.$executeRaw = async (strings, ...values) => (await pg.query(...sql(strings, values))).affectedRows;
    let tail = Promise.resolve();
    database.$transaction = work => {
      const operation = tail.then(async () => {
        const names = ['projectPost', 'editorialInterview', 'editorialInterviewAnswer', 'designerBio'];
        const before = await Promise.all(names.map(name => database[name].findMany()));
        await pg.exec('BEGIN');
        try { const value = typeof work === 'function' ? await work(database) : await Promise.all(work); await pg.exec('COMMIT'); return value; }
        catch (error) {
          await pg.exec('ROLLBACK');
          for (const [index, name] of names.entries()) { await database[name].deleteMany(); for (const row of before[index]) await database[name].create({ data: row }); }
          throw error;
        }
      });
      tail = operation.catch(() => {}); return operation;
    };
    const post = database.projectPost, updateMany = post.updateMany;
    post.updateMany = async args => {
      const { provenance, ...where } = args.where;
      if (provenance) {
        const current = await post.findUnique({ where: { id: args.where.id } });
        const expected = provenance.equals === Prisma.DbNull ? null : provenance.equals;
        if (!current || JSON.stringify(current.provenance) !== JSON.stringify(expected)) return { count: 0 };
      }
      return updateMany({ ...args, where });
    };
    await database.user.create({ data: { id: 'owner', name: 'Synthetic fixture creator', role: 'DESIGNER', accountStatus: 'APPROVED', email: 'owner@fixture.invalid' } });
    await database.user.create({ data: { id: 'other', role: 'DESIGNER', accountStatus: 'APPROVED' } });
    await database.project.create({ data: { id: 'project', title: 'SYNTHETIC FIXTURE PROJECT', ownerId: 'owner', designerId: 'owner', isPublic: true } });
    await database.room.create({ data: { id: 'room', projectId: 'project', name: 'Living Room', type: 'LIVING' } });
    await database.projectImage.create({ data: { id: 'photo', projectId: 'project', roomId: 'room', room: 'room', url: 'https://fixture.invalid/photo.jpg', inclusion: 'INCLUDED', aiClassification: {} } });
    await database.projectPost.create({ data: { id: 'post', projectId: 'project', slug: 'synthetic-journey', status: 'PUBLISHED', publishedAt: new Date(), provenance: null } });
    await database.designerBio.create({ data: { userId: 'owner', status: 'published', folioBio: 'Synthetic published fixture biography.', interviewAnswers: [] } });
    const startRoute = route('live-interviews'), sessionRoute = route('live-interviews/[id]');
    const backendRoute = route('live-interviews/provider/[id]/v1/chat/completions');
    const captureRoute = route('interview-media/capture'), mediaRoute = route('interview-media');
    const playbackRoute = route('interview-media/[id]/playback');
    const liveStore = load('src/lib/live-interview/store.ts'), mediaStore = load('src/lib/interview-media/store.ts');
    const mediaService = load('src/lib/interview-media/service.ts'), worker = load('src/lib/interview-media/worker.ts');
    const renderer = load('src/lib/interview-media/render.ts');
    await renderer.nativeCommand('ffmpeg', ['-version'], dir); await renderer.nativeCommand('ffprobe', ['-version'], dir);
    await renderer.nativeCommand('ffmpeg', [...renderer.encodeBase, '-f', 'lavfi', '-i', 'color=c=0x8B8178:s=320x180:d=2', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=2', '-c:v', 'libvpx', '-c:a', 'libopus', '-shortest', 'SYNTHETIC-FIXTURE.webm'], dir);
    const bytes = await fsp.readFile(path.join(dir, 'SYNTHETIC-FIXTURE.webm'));
    const starts = source => ({ source, requestId: randomUUID(), mode: 'video', consentVersion: '2026-10-01', microphoneReady: true,
      ...(source.kind === 'project' ? { selectedImageId: 'photo' } : {}) });
    const sessionPost = (id, body) => sessionRoute.POST(request(`/api/live-interviews/${id}`, body), { params: { id } });
    actor = null; await json(await startRoute.POST(request('/api/live-interviews', starts({ kind: 'project', id: 'project' }))), 401);
    actor = 'other'; assert.ok((await startRoute.POST(request('/api/live-interviews', starts({ kind: 'project', id: 'project' })))).status >= 400, 'approved non-owner cannot start another creator’s project');
    actor = 'owner'; env.FOLIO_LIVE_INTERVIEWS = '0'; await json(await startRoute.POST(request('/api/live-interviews', starts({ kind: 'project', id: 'project' }))), 403); env.FOLIO_LIVE_INTERVIEWS = '1';
    assert.equal(providerCreates, 0, 'unauthorized and disabled starts never reach provider');
    for (const kind of ['project', 'designer_bio']) {
      const source = { kind, id: kind === 'project' ? 'project' : 'owner' };
      const input = starts(source);
      let current = await json(await startRoute.POST(request('/api/live-interviews', input)));
      assert.equal((await json(await startRoute.POST(request('/api/live-interviews', input)))).id, current.id, 'duplicate HTTP start reuses provider reservation');
      const firstQuestion = current.snapshot.currentQuestion;
      assert.ok(firstQuestion?.id);
      const raw = kind === 'project' ? 'The clients wanted quieter rooms for their daily family life.' : 'Studying architecture helped me understand daylight and proportion.';
      async function answer(session, text, expectedStatus = 'saved') {
        const stored = await liveStore.getLiveSession(session.id), conversationId = stored.providerIds.conversationId;
        const key = pals.get(stored.providerIds.palId).layers.llm.api_key;
        const q = session.snapshot.currentQuestion;
        const speaking = [q.reaction, q.text].filter(Boolean).join(' ');
        const events = [
          { seq: 1, event_type: 'conversation.utterance', role: 'pal', speech: speaking },
          { seq: 2, event_type: 'conversation.stopped_speaking', role: 'pal' },
          { seq: 3, event_type: 'conversation.started_speaking', role: 'user' },
          { seq: 4, event_type: 'conversation.utterance', role: 'user', speech: text },
        ];
        for (const event of events) await json(await sessionPost(session.id, { action: 'event', event: {
          message_type: 'conversation', conversation_id: conversationId, seq: event.seq, event_type: event.event_type, inference_id: 'fixture-inference',
          properties: { role: event.role, interrupted: false, ...(event.speech ? { speech: event.speech } : {}) },
        } }));
        const backend = () => backendRoute.POST(new Request(`https://folio.test/api/live-interviews/provider/${session.id}/v1/chat/completions`, {
          method: 'POST', headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' }, body: JSON.stringify({ stream: true, messages: [{ role: 'user', content: text }] }),
        }), { params: { id: session.id } });
        const response = await backend(); assert.equal(response.status, 200); assert.ok((await response.text()).endsWith('data: [DONE]\n\n'));
        const after = await liveStore.getLiveSession(session.id); assert.equal(after.payload.turnState.turns[0].status, expectedStatus);
        const version = after.payload.snapshot.version;
        await backend(); assert.equal((await liveStore.getLiveSession(session.id)).payload.snapshot.version, version, 'provider replay does not duplicate canonical evidence');
        return after;
      }
      await answer(current, raw);
      if (kind === 'project') {
        const canonical = (await database.projectPost.findUnique({ where: { projectId: 'project' } })).provenance.interview.guided;
        assert.equal(canonical.turns.filter(turn => !turn.supersededBy).length, 1);
        assert.equal(canonical.turns[0].questionId, firstQuestion.id); assert.equal(canonical.turns[0].text, raw);
        assert.equal(canonical.turns[0].selectedImageId, 'photo');
        assert.ok((await database.editorialInterviewAnswer.findMany()).some(answer => answer.questionId === firstQuestion.id && answer.answerText === raw && answer.inputModality === 'voice' && answer.linkedImageId === 'photo'), 'explicit photo survives the real canonical projection');
      } else {
        const bio = await database.designerBio.findUnique({ where: { userId: 'owner' } });
        assert.equal(bio.interviewAnswers[0].id, firstQuestion.id); assert.equal(bio.interviewAnswers[0].question, firstQuestion.text); assert.equal(bio.interviewAnswers[0].answer, raw);
      }
      const paused = await json(await sessionPost(current.id, { action: 'pause' })); assert.equal(paused.status, 'ended');
      current = await json(await startRoute.POST(request('/api/live-interviews', starts(source))));
      assert.notEqual(current.snapshot.currentQuestion.id, firstQuestion.id, 'resume restores canonical next question');
      if (kind === 'project') {
        const guided = load('src/lib/interview/guided/service.ts');
        const canonical = await guided.getGuidedSession('project', 'owner');
        await guided.runGuidedCommand('project', 'owner', { action: 'correct', sessionId: canonical.id, version: canonical.version,
          requestId: randomUUID(), questionId: firstQuestion.id, text: 'A correction saved from the existing text interview.' });
        await answer(current, raw, 'needs_review');
        await json(await sessionPost(current.id, { action: 'switch_to_text' }));
        const refreshed = await json(await sessionPost(current.id, { action: 'refresh_review' }));
        assert.equal(refreshed.turns[0].raw, raw); assert.equal(refreshed.turns[0].status, 'needs_review', 'refresh alone never accepts or reattributes retained speech');
        const recovered = await json(await sessionPost(current.id, { action: 'recover', turnPosition: 1, target: 'current', text: raw }));
        assert.equal(recovered.turns[0].status, 'saved', 'explicit review succeeds after a real canonical stale-version conflict');
        current = await json(await startRoute.POST(request('/api/live-interviews', starts(source))));
      }
      sourceText = raw; // Synthetic ASR transcript; fixture media is a tone, not creator speech.
      const capture = body => captureRoute.POST(request('/api/interview-media/capture', body));
      const { runId } = await json(await capture({ action: 'start', sessionId: current.id, mimeType: 'video/webm', offsetMs: 7000 }));
      await answer(current, raw); // Identical wording on the resumed question is new canonical evidence.
      for (const [index, chunk] of [bytes.subarray(0, Math.floor(bytes.length / 2)), bytes.subarray(Math.floor(bytes.length / 2))].entries()) {
        const signed = await json(await capture({ action: 'chunk', runId, index, bytes: chunk.length }));
        objects.set(signed.path, { bytes: chunk, mime: 'video/webm' });
        await json(await capture({ action: 'ack', runId, index }));
      }
      await json(await capture({ action: 'finalize', runId, chunkCount: 2, durationMs: 2000 }));
      assert.equal(await worker.processOneMediaJob(), true);
      const readyCapture = await mediaStore.readMedia('owner', runId); assert.equal(readyCapture.state, 'ready', JSON.stringify(readyCapture.payload));
      assert.equal(readyCapture.payload.offsetMs, 7000); assert.equal(readyCapture.payload.moments[0].quoteText, raw);
      assert.ok(readyCapture.payload.evidence.turns.some(turn => turn.raw === raw && turn.status === 'saved'), 'recording retains the accepted live turn and exact question attribution');
      assert.equal(readyCapture.payload.transcript[0].startMs, 0, 'caption time is recording-relative, not provider receipt time');
      const plan = await json(await mediaRoute.POST(request('/api/interview-media', {
        sessionId: current.id, title: `SYNTHETIC ${kind} JOURNEY`, description: 'Automated test artifact, mocked ASR and synthetic tone.', credits: 'Synthetic fixture',
        format: kind === 'project' ? 'short' : 'audio', aspect: 'portrait', scenes: [{ captureId: runId, captureVersion: readyCapture.version, startMs: 0, endMs: 2000, speakerId: 'owner', captionOrders: [0], chapter: 'Test chapter' }],
      })));
      assert.equal(await worker.processOneMediaJob(), true);
      let ready = await mediaStore.readMedia('owner', plan.id); assert.equal(ready.state, 'ready', JSON.stringify(ready.payload));
      const output = ready.payload.output;
      await fsp.writeFile(path.join(dir, `${kind}.mp4`), objects.get(output.key).bytes);
      assert.ok((await renderer.probeMedia(`${kind}.mp4`, dir, kind === 'project')).durationMs >= 1900);
      const delivery = purpose => playbackRoute.GET(new Request(`https://folio.test/api/interview-media/${plan.id}/playback?purpose=${purpose}`), { params: { id: plan.id } });
      await json(await delivery('preview')); assert.equal((await delivery('export')).status, 409);
      const action = async action => {
        const response = await mediaRoute.PATCH(request('/api/interview-media', { id: plan.id, action, expectedVersion: ready.version }));
        await json(response); ready = await mediaStore.readMedia('owner', plan.id);
      };
      await action('approve'); assert.equal((await delivery('export')).status, 409, 'approval alone is not publication');
      await action('publish'); assert.equal(new URL((await json(await delivery('export'))).url).pathname.slice(1), output.key, 'approved export is the playable file verified above');
      assert.ok((await mediaService.publicMediaPiece(plan.id)).url);
      const corrected = `${raw} This is the corrected editorial answer.`;
      await json(await sessionPost(current.id, { action: 'control', command: { action: 'correct', requestId: randomUUID(), questionId: firstQuestion.id, text: corrected } }));
      assert.equal((await delivery('export')).status, 409, 'canonical correction invalidates approved export');
      await assert.rejects(mediaService.publicMediaPiece(plan.id), /source changed/);
      assert.equal((await mediaStore.readMedia('owner', runId)).payload.transcript[0].text, raw, 'editorial correction never rewrites stored recording transcript');
      await action('withdraw'); await assert.rejects(mediaService.publicMediaPiece(plan.id), /unavailable/);
      await json(await sessionPost(current.id, { action: 'end' }));
      assert.equal((await liveStore.getLiveSession(current.id)).status, 'ended');
      console.log(`PASS composed ${kind}: real HTTP→adapter→canonical evidence→resume→private playable recording→moment→render→approve/publish/export→correction revokes→provider cleanup`);
    }
    assert.equal(pals.size, 0); assert.ok([...conversations.values()].every(conversation => conversation.status === 'ended')); assert.ok(modelCalls > 0);
    console.log('LIMITS: in-process HTTP, not browser/device/Tavus turn-taking; existing Prisma delegates doubled, session/media SQL real PGlite; ASR/LLM/storage/provider synthetic; FFmpeg outputs are real tone/color fixtures. No production schema, paid calls, or network used.');
  } finally { await pg.close(); await fsp.rm(dir, { recursive: true, force: true }); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
