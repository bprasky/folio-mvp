// Actual HTTP route -> service -> controller -> store -> answer projection.
// Reuses the core orchestration double. This is NOT PostgreSQL lock/isolation
// proof: transactions and JSON compare-and-swap are deterministic boundary doubles.
// No .env loader, live credentials, PrismaClient instance, or network is used.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { memoryDatabase } = require('./core/memory-db.cjs');
const { Prisma } = require('@prisma/client');

const environment = {
  NODE_ENV: 'test', NEXT_PUBLIC_FLAG_GUIDED_INTERVIEW: '1',
  ANTHROPIC_API_KEY: 'guided-synthetic-key', ANTHROPIC_ENABLED: 'true',
  DATABASE_URL: 'postgresql://disabled:disabled@127.0.0.1:1/guided_test_disabled',
  SPOTLIGHT_PROJECT_IDS: '', SPOTLIGHT_ACTOR_IDS: '', SPOTLIGHT_INTERVIEW_V1: 'false',
};
let database, authUser = 'owner', providerCalls = [], networkCalls = 0;
let decisionMode = 'advance', pendingModel = null, decisionEntered = null;
let failNextCas = false, failProjection = false, failNextDecisionCommit = false;
const cache = new Map();
const PROJECT_TEXT = [
  'What did the clients come to you wanting from this project?',
  'What were you working within on this project?',
  'What was the overall design idea for this project?',
  'What in this project is most recognizably yours?',
  'What discovery changed the direction of this project along the way?',
];
const CATEGORIES = ['CLIENT_BRIEF', 'SCOPE_PARAMETERS', 'DESIGN_DIRECTION', 'SIGNATURE_IDENTITY', 'SURPRISE_PIVOT'];
const clone = value => structuredClone(value);
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };

function fixtureResponse(output) {
  return { model: 'synthetic-guided-model', stop_reason: 'end_turn', usage: { input_tokens: 10, output_tokens: 5 }, content: [{ type: 'text', text: JSON.stringify(output) }] };
}
class AnthropicFixture {
  messages = { create: async input => {
    providerCalls.push(input);
    const text = JSON.stringify(input.messages);
    if (String(input.system || '').includes('bounded next-turn proposal')) {
      // This assertion is inside the provider boundary: answers/projection must
      // already be durable before the application asks for a next-turn proposal.
      const accepted = JSON.parse(input.messages[0].content).currentAnswer;
      const post = await database.projectPost.findUnique({ where: { projectId: 'project' } });
      assert.ok(post.provenance.interview.guided.turns.some(t => t.id === accepted.id && t.text === accepted.text));
      assert.ok((await database.editorialInterviewAnswer.findMany()).some(a => a.answerText === accepted.text.trim()));
      if (failNextDecisionCommit) { failNextDecisionCommit = false; failNextCas = true; }
      if (decisionMode === 'reject') throw new Error('synthetic provider outage');
      if (decisionMode === 'defer') {
        pendingModel = deferred(); decisionEntered?.resolve();
        return fixtureResponse(await pendingModel.promise);
      }
      if (decisionMode === 'followup') {
        const scope = JSON.parse(input.messages[0].content).scope;
        return fixtureResponse({ kind: 'followup', purpose: scope === 'room' ? 'room_decision' : 'project_example', sourceAnswerIds: [accepted.id], evidence: accepted.text.slice(0, 100) });
      }
      return fixtureResponse({ kind: 'advance' });
    }
    if (text.includes('opening interview questions')) return fixtureResponse({ questions: CATEGORIES.map((category, i) => ({ category, question: PROJECT_TEXT[i] })) });
    if (text.includes("interviewer's notebook")) return fixtureResponse({ direction: 'A room intended to support daily life.' });
    if (text.includes('Generate room-level questions') || text.includes('AI-DETECTED DETAILS:')) return fixtureResponse({ questions: [
      { text: 'What did you want this room to make possible?', type: 'opening', topic: 'room_intent', products: [], vendors: [] },
      { text: 'How did you want this room to support daily life?', type: 'spatial_narrative', topic: 'room_use', products: [], vendors: [] },
      { text: 'What shaped the layout of this room?', type: 'spatial_narrative', topic: 'room_layout', products: [], vendors: [] },
    ] });
    throw new Error('Unexpected provider request in guided integration fixture');
  } };
}

const facade = new Proxy({}, { get: (_, key) => {
  const value = database[key]; return typeof value === 'function' ? value.bind(database) : value;
} });
function load(file) {
  file = path.resolve(file);
  if (cache.has(file)) return cache.get(file);
  const exports = {}; cache.set(file, exports);
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
  } }).outputText;
  vm.runInNewContext(code, {
    exports, process: { env: environment }, console, Error, SyntaxError, TypeError, Date, URL, Request, Response,
    structuredClone, Buffer, setTimeout, clearTimeout,
    fetch: async () => { networkCalls++; throw new Error('Network is forbidden in this fixture'); },
    require(name) {
      if (name === '@/lib/prisma') return { prisma: facade };
      if (name === 'next-auth') return { getServerSession: async () => authUser ? { user: { id: authUser } } : null };
      if (name === '@/app/api/auth/[...nextauth]/options') return { authOptions: {} };
      if (name === 'next/server') return { NextRequest: Request, NextResponse: { json: (body, options) => Response.json(body, options) } };
      if (name === 'next/cache') return { revalidatePath: () => {} };
      if (name === '@anthropic-ai/sdk') return AnthropicFixture;
      if (name === '@/lib/posting/slug') return { makeSlug: () => 'synthetic-guided-project' };
      if (name === 'server-only') return {};
      if (name.startsWith('@/')) return load(path.resolve('src', name.slice(2)) + '.ts');
      if (name.startsWith('.')) return load(path.resolve(path.dirname(file), name) + '.ts');
      return require(name);
    },
  }, { filename: file });
  return exports;
}

async function fixture() {
  database = memoryDatabase(); authUser = 'owner'; providerCalls = []; decisionMode = 'advance';
  failNextCas = false; failProjection = false; failNextDecisionCommit = false;
  environment.NEXT_PUBLIC_FLAG_GUIDED_INTERVIEW = '1'; environment.SPOTLIGHT_PROJECT_IDS = '';
  const postModel = database.projectPost;
  database.projectPost = new Proxy(postModel, { get: (target, method) => {
    if (method !== 'updateMany') return target[method];
    return async args => {
      if (failNextCas) { failNextCas = false; return { count: 0 }; }
      const { provenance, ...where } = args.where;
      const current = await target.findUnique({ where: { id: args.where.id } });
      const expected = provenance?.equals === Prisma.DbNull ? null : provenance?.equals;
      if (!current || provenance && JSON.stringify(current.provenance) !== JSON.stringify(expected)) return { count: 0 };
      return target.updateMany({ ...args, where });
    };
  } });
  const answerModel = database.editorialInterviewAnswer;
  database.editorialInterviewAnswer = new Proxy(answerModel, { get: (target, method) => {
    if (method === 'create') return async args => { if (failProjection) { failProjection = false; throw new Error('synthetic projection failure'); } return target.create(args); };
    return target[method];
  } });
  // A serialized transaction boundary with rollback permits deterministic
  // application-level race tests. Database lock behavior remains unverified.
  let transactionTail = Promise.resolve();
  database.$transaction = async work => {
    const previous = transactionTail; const unlocked = deferred(); transactionTail = unlocked.promise;
    await previous;
    const names = ['projectPost', 'editorialInterview', 'editorialInterviewAnswer'];
    const snapshot = await Promise.all(names.map(name => database[name].findMany()));
    try { return typeof work === 'function' ? await work(database) : await Promise.all(work); }
    catch (error) {
      for (let i = 0; i < names.length; i++) {
        const model = names[i] === 'projectPost' ? postModel : names[i] === 'editorialInterviewAnswer' ? answerModel : database[names[i]];
        await model.deleteMany();
        for (const row of snapshot[i]) await model.create({ data: row });
      }
      throw error;
    } finally { unlocked.resolve(); }
  };
  await database.user.create({ data: { id: 'owner', name: 'Fixture Designer', email: 'owner@guided.test', role: 'DESIGNER', accountStatus: 'APPROVED' } });
  await database.user.create({ data: { id: 'other', name: 'Other User', email: 'other@guided.test', role: 'DESIGNER', accountStatus: 'APPROVED' } });
  await database.project.create({ data: { id: 'project', title: 'Synthetic guided project', ownerId: 'owner', designerId: 'owner' } });
  await database.room.create({ data: { id: 'room', projectId: 'project', name: 'Living Room', type: 'LIVING' } });
  await database.projectImage.create({ data: { id: 'photo', projectId: 'project', roomId: 'room', room: 'room', url: 'https://fixture.invalid/room.jpg', inclusion: 'INCLUDED', aiClassification: {} } });
}
const route = load('src/app/api/posting/project/[projectId]/interview/guided/route.ts');
const { InterviewPayloadSchema } = load('src/lib/posting/interviewSchemas.ts');
const params = { params: { projectId: 'project' } };
let sequence = 0;
const requestId = () => `request-${++sequence}`;
async function post(command) {
  const response = await route.POST(new Request('http://folio.test/api/posting/project/project/interview/guided', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(command),
  }), params);
  return { status: response.status, ...(await response.json()) };
}
async function start() { const response = await post({ action: 'start', version: 0, requestId: requestId() }); assert.equal(response.status, 200, JSON.stringify(response)); return response.session; }
async function saved() { return (await database.projectPost.findUnique({ where: { projectId: 'project' } })).provenance.interview.guided; }
async function answer(session, text = 'Calm and welcoming.', extras = {}) {
  return post({ action: 'answer', version: session.version, questionId: session.activeQuestionId, requestId: requestId(), text, ...extras });
}

async function run() {
  await fixture();
  authUser = null;
  assert.equal((await post({ action: 'start', version: 0, requestId: requestId() })).status, 401);
  authUser = 'other';
  assert.equal((await post({ action: 'start', version: 0, requestId: requestId() })).status, 403);
  authUser = 'owner'; environment.SPOTLIGHT_PROJECT_IDS = 'project';
  const protectedResult = await post({ action: 'start', version: 0, requestId: requestId() });
  assert.equal(protectedResult.status, 409); assert.equal(protectedResult.code, 'PRIVATE_INTERVIEW_REQUIRED');
  environment.SPOTLIGHT_PROJECT_IDS = ''; environment.NEXT_PUBLIC_FLAG_GUIDED_INTERVIEW = '0';
  assert.equal((await post({ action: 'start', version: 0, requestId: requestId() })).status, 404);
  assert.equal(providerCalls.length, 0); assert.equal(await database.projectPost.count(), 0);
  console.log('PASS actual authorization, pilot flag, and protected spotlight routing before preparation or writes');

  await fixture();
  const beforeRollback = await start();
  environment.NEXT_PUBLIC_FLAG_GUIDED_INTERVIEW = '0';
  const drainRead = await route.GET(new Request('http://folio.test/interview/guided'), params);
  assert.equal(drainRead.status, 200, 'Flag rollback must preserve access to an existing session.');
  const drainWrite = await answer(beforeRollback, 'A quiet house for a family who often gathers together.');
  assert.equal(drainWrite.status, 200, 'An existing guided session keeps its version-aware writer after rollback.');
  environment.SPOTLIGHT_PROJECT_IDS = 'project';
  assert.equal((await answer(drainWrite.session)).status, 409, 'Spotlight enrollment still blocks a draining guided session.');
  console.log('PASS rollback stops enrollment but saved sessions finish through the protected guided writer');

  await fixture();
  let session = await start(); const callsAfterStart = providerCalls.length;
  assert.equal((await start()).id, session.id); assert.equal(providerCalls.length, callsAfterStart);
  const firstCommand = { action: 'answer', version: session.version, questionId: session.activeQuestionId, requestId: requestId(), text: 'A place for the family to gather.' };
  const first = await post(firstCommand); assert.equal(first.status, 200); session = first.session;
  const duplicate = await post(firstCommand); assert.equal(duplicate.status, 200); assert.equal(duplicate.session.version, session.version);
  assert.equal((await saved()).turns.length, 1);
  for (const changedPayload of [
    { text: 'Different text must not be reported saved.' },
    { action: 'skip' },
    { version: session.version },
    { questionId: 'different-question' },
    { inputModality: 'voice' },
    { selectedImageId: 'different-photo' },
    { recordingId: '66666666-6666-4666-8666-666666666666' },
    { roomId: 'different-room' },
  ]) {
    const conflictingReplay = await post({ ...firstCommand, ...changedPayload });
    assert.equal(conflictingReplay.status, 409);
    assert.equal(conflictingReplay.code, 'REQUEST_ID_REUSED');
    assert.equal((await saved()).turns[0].text, firstCommand.text);
    assert.equal((await saved()).turns.length, 1);
  }
  const stale = await post({ ...firstCommand, requestId: requestId(), text: 'A stale tab answer.' });
  assert.equal(stale.status, 409); assert.equal(stale.code, 'STALE_VERSION');
  const restored = await route.GET(new Request('http://folio.test/api/test'), params);
  assert.equal((await restored.json()).session.activeQuestionId, session.activeQuestionId);
  assert.equal(restored.headers.get('cache-control'), 'no-store');
  console.log('PASS durable restore, exact replay, conflicting-payload request digest rejection, and stale tab rejection');

  await fixture(); session = await start();
  const concurrentCommand = { action: 'answer', version: session.version, questionId: session.activeQuestionId, requestId: requestId(), text: 'Only one copy of this answer.' };
  const concurrent = await Promise.all([post(concurrentCommand), post(concurrentCommand)]);
  assert.ok(concurrent.some(result => result.status === 200));
  assert.ok(concurrent.every(result => [200, 409].includes(result.status)));
  assert.equal((await saved()).turns.length, 1);
  assert.equal((await post(concurrentCommand)).status, 200, 'The losing simultaneous retry restores the winner.');
  session = await saved();
  const competing = await Promise.all([
    answer(session, 'The answer from the first tab.'),
    answer(session, 'The answer from the second tab.'),
  ]);
  assert.deepEqual(competing.map(result => result.status).sort(), [200, 409]);
  assert.equal((await saved()).turns.length, 2);
  console.log('PASS concurrent duplicate POSTs and competing same-version tabs produce one accepted turn and one next decision');

  await fixture(); session = await start();
  decisionMode = 'reject';
  const outage = await answer(session, 'Quiet and open.'); assert.equal(outage.status, 200);
  assert.equal(outage.session.turns[0].text, 'Quiet and open.');
  assert.notEqual(outage.session.activeQuestionId, session.activeQuestionId);
  decisionMode = 'advance'; session = outage.session; failNextDecisionCommit = true;
  const interrupted = await answer(session, 'A compact renovation.'); assert.equal(interrupted.status, 200);
  assert.equal(interrupted.session.status, 'deciding'); assert.match(interrupted.session.notice, /answer is saved/i);
  assert.equal(interrupted.session.turns.length, 2);
  const retried = await post({ action: 'retry', version: interrupted.session.version, requestId: requestId() });
  assert.equal(retried.status, 200); assert.equal(retried.session.turns.length, 2); assert.equal(retried.session.status, 'active');
  console.log('PASS answer and canonical projection commit before provider; provider outage continuation and failed decision-save retry');

  await fixture(); session = await start();
  failProjection = true;
  const failedSave = await answer(session, 'This must remain unsaved.'); assert.equal(failedSave.status, 500);
  assert.equal((await saved()).turns.length, 0); assert.equal(await database.editorialInterviewAnswer.count(), 0);
  const recovered = await answer(await saved(), 'This must remain unsaved.'); assert.equal(recovered.status, 200);
  assert.equal(recovered.session.turns.length, 1);
  console.log('PASS projection failure rolls back the answer and cursor, with successful retry');

  await fixture(); session = await start();
  decisionMode = 'defer'; decisionEntered = deferred();
  const inFlight = answer(session, 'An open room.'); await decisionEntered.promise;
  const accepted = await saved(); assert.equal(accepted.status, 'deciding'); assert.equal(accepted.turns.length, 1);
  const paused = await post({ action: 'pause', version: accepted.version, requestId: requestId() }); assert.equal(paused.status, 200);
  pendingModel.resolve({ kind: 'followup', purpose: 'project_example', sourceAnswerIds: [accepted.turns[0].id], evidence: 'An open room.' });
  const late = await inFlight;
  assert.equal(late.session.status, 'paused'); assert.equal(late.session.version, paused.session.version);
  assert.equal(late.session.plan.filter(q => q.kind === 'followup').length, 0);
  decisionMode = 'advance';
  const resumed = await post({ action: 'resume', version: paused.session.version, requestId: requestId() });
  assert.equal(resumed.session.status, 'active'); assert.equal(resumed.session.turns.length, 1);
  console.log('PASS late model response cannot overwrite a newer pause or create a duplicate next question');

  await fixture(); session = await start(); decisionMode = 'followup';
  let result = await answer(session, 'The project needed a quieter daily rhythm.'); assert.equal(result.status, 200); session = result.session;
  const parent = session.turns[0]; const followup = session.plan.find(q => q.id === session.activeQuestionId);
  assert.equal(followup.parentAnswerId, parent.id);
  result = await answer(session, 'We began with the daily route through the home.'); assert.equal(result.status, 200); session = result.session;
  const rows = await database.editorialInterviewAnswer.findMany();
  const parentRow = rows.find(row => row.questionId === parent.questionId);
  const followupRow = rows.find(row => row.questionId === followup.id);
  assert.equal(followupRow.parentAnswerId, parentRow.id); assert.equal(followupRow.questionText, followup.text);
  const corrected = await post({ action: 'correct', version: session.version, questionId: parent.questionId, requestId: requestId(), text: 'Correction: the priority was gathering, not quiet.' });
  assert.equal(corrected.status, 200); assert.ok(corrected.session.turns[0].supersededBy);
  assert.equal((await database.editorialInterviewAnswer.findMany()).some(row => row.questionId === followup.id), false);
  assert.ok(corrected.session.turns.some(turn => turn.questionId === followup.id), 'Invalidated evidence remains in original history.');
  console.log('PASS follow-up parentage in canonical projection; correction invalidates dependent evidence but retains history');

  await fixture(); session = await start();
  const initialPost = await database.projectPost.findUnique({ where: { projectId: 'project' } });
  const recordedQuestion = session.activeQuestionId;
  const originalRecordingId = '11111111-1111-4111-8111-111111111111';
  const laterRecordingId = '22222222-2222-4222-8222-222222222222';
  const wrongProjectRecordingId = '33333333-3333-4333-8333-333333333333';
  const wrongQuestionRecordingId = '44444444-4444-4444-8444-444444444444';
  const recording = { id: originalRecordingId, projectId: 'project', questionId: recordedQuestion,
    transcript: 'Gathering was the priority.', audioUrl: 'https://fixture.invalid/original-recording.webm',
    words: [{ word: 'Gathering', start: 0, end: 1 }], capturedAt: new Date().toISOString() };
  const laterRecording = { ...recording, id: laterRecordingId, audioUrl: 'https://fixture.invalid/other-tab-recording.webm', transcript: 'Different text from the other tab.' };
  await database.projectPost.update({ where: { id: initialPost.id }, data: { provenance: {
    ...initialPost.provenance, interview: { ...initialPost.provenance.interview, guidedAudio: {
      [originalRecordingId]: recording,
      [laterRecordingId]: laterRecording,
      [wrongProjectRecordingId]: { ...recording, id: wrongProjectRecordingId, projectId: 'another-project' },
      [wrongQuestionRecordingId]: { ...recording, id: wrongQuestionRecordingId, questionId: 'another-question' },
    } },
  } } });
  for (const recordingId of ['55555555-5555-4555-8555-555555555555', wrongProjectRecordingId, wrongQuestionRecordingId]) {
    const badRecording = await answer(session, 'Gathering was the priority.', { inputModality: 'voice', recordingId });
    assert.equal(badRecording.status, 422); assert.equal(badRecording.code, 'RECORDING_MISMATCH');
    assert.equal((await saved()).turns.length, 0);
  }
  const textWithRecording = await answer(session, 'Gathering was the priority.', { inputModality: 'text', recordingId: originalRecordingId });
  assert.equal(textWithRecording.status, 422); assert.equal(textWithRecording.code, 'RECORDING_MISMATCH');
  const voice = await answer(session, 'Gathering was the priority.', { inputModality: 'voice', recordingId: originalRecordingId }); assert.equal(voice.status, 200);
  assert.equal(voice.session.turns[0].recording.audioUrl, recording.audioUrl);
  assert.equal(voice.session.turns[0].recordingId, originalRecordingId);
  assert.equal(voice.session.turns[0].recording.textMatchesTranscript, true);
  assert.equal((await database.editorialInterviewAnswer.findMany())[0].audioUrl, recording.audioUrl);
  assert.equal((await database.editorialInterviewAnswer.findMany())[0].wordTimings.length, 1);
  const mixedCorrection = await post({ action: 'correct', version: voice.session.version, questionId: recordedQuestion, requestId: requestId(), text: 'Gathering on weekends was the priority.', inputModality: 'mixed', recordingId: laterRecordingId });
  assert.equal(mixedCorrection.status, 200);
  assert.equal(mixedCorrection.session.turns[1].recording.textMatchesTranscript, false);
  assert.equal(mixedCorrection.session.turns[1].recording.words.length, 1, 'The original clip timing remains in immutable history.');
  const mixedPost = await database.projectPost.findUnique({ where: { projectId: 'project' } });
  assert.equal(mixedPost.provenance.interview.audio[recordedQuestion].words.length, 0, 'Edited transcript text cannot inherit old word timings.');
  assert.equal((await database.editorialInterviewAnswer.findMany())[0].wordTimings, null);
  const typedCorrection = await post({ action: 'correct', version: mixedCorrection.session.version, questionId: recordedQuestion, requestId: requestId(), text: 'Gathering on summer weekends was the priority.', inputModality: 'text' });
  assert.equal(typedCorrection.status, 200);
  assert.equal(typedCorrection.session.turns[0].recording.audioUrl, recording.audioUrl);
  assert.equal((await database.editorialInterviewAnswer.findMany())[0].audioUrl, null);
  assert.equal((await database.projectPost.findUnique({ where: { projectId: 'project' } })).provenance.interview.audio[recordedQuestion], null);
  console.log('PASS exact recording IDs reject absent/foreign/question-mismatched clips, preserve each tab’s clip, and clear obsolete timing/audio after mixed/text edits');

  await fixture(); session = await start();
  const changedRequest = { action: 'answer', version: session.version, questionId: session.activeQuestionId, requestId: requestId(), text: 'Text composed before the photograph moved.' };
  await database.room.create({ data: { id: 'other-room', projectId: 'project', name: 'Dining Room', type: 'DINING' } });
  await database.projectImage.update({ where: { id: 'photo' }, data: { roomId: 'other-room', room: 'other-room' } });
  const changedSources = await post(changedRequest);
  assert.equal(changedSources.status, 200); assert.match(changedSources.session.notice, /sources changed/i);
  assert.equal(changedSources.session.requestIds.includes(changedRequest.requestId), false, 'A source refresh cannot claim the unsaved composer was accepted.');
  assert.equal(changedSources.session.turns.length, 0);
  assert.equal(changedSources.session.rooms.find(room => room.id === 'other-room').imageIds[0], 'photo');
  console.log('PASS changed photo room assignment refreshes the plan without accepting or reattributing the pending answer');

  await fixture(); session = await start();
  const long = await answer(session, 'x'.repeat(2001)); assert.equal(long.status, 422); assert.equal((await saved()).turns.length, 0);
  const controlCommand = { action: 'answer', version: session.version, questionId: session.activeQuestionId, requestId: requestId(), text: "Let's move on." };
  const control = await post(controlCommand); assert.equal(control.status, 200);
  const controlReplay = await post(controlCommand); assert.equal(controlReplay.status, 200); assert.equal(controlReplay.session.version, control.session.version);
  assert.equal(control.session.turns[0].kind, 'skip'); assert.equal(await database.editorialInterviewAnswer.count(), 0);
  session = control.session;
  while (!session.roomsPrepared) {
    const response = await answer(session, 'We considered everyday movement through the project.'); assert.equal(response.status, 200); session = response.session;
  }
  assert.equal(session.plan.filter(q => q.roomId === null && q.kind === 'prepared').length, 5);
  assert.equal(session.plan.filter(q => q.roomId === 'room' && q.kind === 'prepared').length, 3);
  const roomAnswer = await answer(session, 'We kept the route open for daily use.', { inputModality: 'voice', selectedImageId: 'photo' });
  assert.equal(roomAnswer.status, 200); session = roomAnswer.session;
  let finish = await post({ action: 'finish', version: session.version, requestId: requestId() }); assert.equal(finish.status, 422);
  finish = await post({ action: 'finish', version: session.version, requestId: requestId(), confirmPartial: true });
  assert.equal(finish.status, 200); assert.equal(finish.session.status, 'finished');
  const finalPost = await database.projectPost.findUnique({ where: { projectId: 'project' } });
  assert.equal(finalPost.status, 'DRAFT');
  const payload = InterviewPayloadSchema.parse(finalPost.provenance.interview.payload);
  const roomEvidence = payload.answers.find(answer => answer.roomId === 'room');
  assert.equal(roomEvidence.answer, 'We kept the route open for daily use.'); assert.equal(roomEvidence.linkedImageId, 'photo');
  assert.equal(roomEvidence.inputModality, 'voice'); assert.equal(roomEvidence.role, 'DESIGNER');
  assert.equal((await database.editorialInterview.findUnique({ where: { projectId: 'project' } })).status, 'COMPLETED');
  assert.equal(networkCalls, 0);
  console.log('PASS lossless rejection of oversized text, skip provenance, staged five-category/room plan, attributable canonical draft payload, and explicit partial completion without publication');
  console.log('Guided HTTP/service/store integration checks passed. PostgreSQL isolation, actual transcription, and editorial model generation are not simulated as verified.');
}
run().catch(error => { console.error(error); process.exitCode = 1; });
