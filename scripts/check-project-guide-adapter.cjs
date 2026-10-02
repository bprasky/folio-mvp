// Guide adapter with deterministic model/database boundaries. Real controller
// verifies canonical transitions; actual Prisma reservation locking runs in CI.
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..'), cache = new Map();
let canonical = null, legacy = [], planAction = 'none', planDetail, membership = true, calls = [];
const project = { id: 'project', title: 'Fixture House', rooms: [{ id: 'room' }], images: [
  { id: 'tagged', inclusion: 'INCLUDED', roomId: 'room', noProducts: false, _count: { tags: 1 } },
  { id: 'architecture', inclusion: 'INCLUDED', roomId: 'room', noProducts: true, _count: { tags: 0 } },
  { id: 'unsorted', inclusion: 'INCLUDED', roomId: null, noProducts: false, _count: { tags: 0 } },
  { id: 'excluded', inclusion: 'EXCLUDED', roomId: 'room', noProducts: false, _count: { tags: 7 } },
  { id: 'document', name: 'specifications.pdf', inclusion: 'INCLUDED', roomId: 'room', noProducts: false, _count: { tags: 5 } },
] };
const mocks = {
  'server-only': {},
  'next/cache': { revalidatePath: () => {} },
  '@/lib/prisma': { prisma: { project: { findUnique: async () => structuredClone(project) }, user: { findUnique: async () => ({ operatingAsOrgId: 'org', accountStatus: 'APPROVED' }) },
    organizationUser: { findFirst: async () => membership ? { role: 'OWNER', organization: { type: 'DESIGN_FIRM' } } : null } } },
  '@/lib/authz/access': { assertProjectWrite: async (actor, id) => { if (actor !== 'owner' || id !== 'project') throw Error('Forbidden'); } },
  '@/lib/spotlight/legacyBoundary': { assertLegacyInterviewAllowed: () => {} },
  '@/lib/posting/loadInterviewAnswers': { loadInterviewAnswers: async () => structuredClone(legacy) },
  '@/lib/interview/guided/service': {
    getGuidedSession: async () => canonical && structuredClone(canonical),
    runGuidedCommand: async (projectId, actor, command) => {
      assert.equal(projectId, 'project'); assert.equal(actor, 'owner'); calls.push(structuredClone(command));
      if (!canonical) canonical = controller.createGuidedSession(projectId, preparation(), command.requestId, command);
      else canonical = controller.acceptCommand(canonical, command);
      if (canonical.status === 'deciding') { controller.applyDecision(canonical, { kind: 'advance' }); canonical.version++; }
      return structuredClone(canonical);
    },
  },
  './project-guide-planner': { planProjectGuide: async input => {
    assert.equal('canonical' in input, false); assert.equal('version' in input, false);
    assert.equal('reviewedPhotoCount' in input, false, 'strict planner schema receives only the declared contract');
    return { reply: 'Saved project context is available. What would you like to do next?', action: input.userText ? planAction : 'none', detailText: input.userText ? planDetail : undefined };
  } },
};
// The real common dispatcher is exercised below; unrelated source engines have
// their own seven-kind suite and are never invoked in this project-guide test.
for (const module of ['@/lib/permissions', '@/lib/spotlight/service', '@/lib/publishing-studio/expertise/service',
  '@/lib/publishing-studio/story-service', '@/lib/designer-bio/interview-service', '@/lib/org-onboarding/interview-service',
  '@/lib/org-onboarding/conversational-interview-questions', '@/lib/collaboration/interview-service']) mocks[module] = {};
function load(file) {
  const full = path.resolve(root, file); if (cache.has(full)) return cache.get(full).exports;
  const module = { exports: {} }; cache.set(full, module);
  const local = name => {
    if (name in mocks) return mocks[name];
    const target = name.startsWith('@/') ? path.join(root, 'src', name.slice(2)) : name.startsWith('.') ? path.resolve(path.dirname(full), name) : null;
    return target ? load(target + '.ts') : require(name);
  };
  const code = ts.transpileModule(fs.readFileSync(full, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(`(function(require,module,exports){${code}\n})`, { process: { env: { NEXT_PUBLIC_FLAG_GUIDED_INTERVIEW: '1' } }, structuredClone, console, Date })(local, module, module.exports);
  return module.exports;
}
const controller = load('src/lib/interview/guided/controller.ts');
const guide = load('src/lib/live-interview/project-guide.ts');
const adapters = load('src/lib/live-interview/adapters.ts');
const categories = ['CLIENT_BRIEF','SCOPE_PARAMETERS','DESIGN_DIRECTION','SIGNATURE_IDENTITY','SURPRISE_PIVOT'];
const preparation = () => ({ rooms: [{ id: 'room', name: 'Living Room', imageIds: ['tagged','architecture'], baseQuestions: 3, maxFollowUps: 1 }], contextFingerprint: 'fixture', minimumTotalAnswers: 8,
  questions: categories.map((category, i) => ({ id: `question-${i}`, text: 'What shaped your approach to this project?', category, roomId: null, sourceImageIds: ['tagged'], sourceAnswerIds: [], status: 'pending', kind: 'prepared' })) });
const source = { kind: 'project_guide', id: 'project' };
let count = 0;
async function test(name, work) { await work(); count++; console.log('PASS ' + name); }
const command = (guideAction, requestId = `request-${Math.random()}`) => ({ action: 'guide', guideAction, requestId });
(async () => {
  await test('author-only context counts saved included photographs and distinguishes tags from product-free review', async () => {
    const context = await guide.readProjectGuideContext('owner', source);
    assert.deepEqual([context.photoCount, context.taggedPhotoCount, context.reviewedPhotoCount, context.sortedPhotoCount, context.unreviewedPhotoCount], [3,1,2,2,1]);
    assert.equal(context.stage, 'tagging'); assert.ok(context.allowedActions.includes('start_interview'), 'tagging remains advisory');
    await assert.rejects(guide.readProjectGuideContext('other', source));
  });
  await test('pre-project guide is actor-bound and checks actual firm create eligibility', async () => {
    assert.equal((await guide.readProjectGuideContext('owner', { kind: 'project_guide', id: 'new:owner' })).projectId, null);
    await assert.rejects(guide.readProjectGuideContext('other', { kind: 'project_guide', id: 'new:owner' }));
    membership = false; await assert.rejects(guide.readProjectGuideContext('owner', { kind: 'project_guide', id: 'new:owner' })); membership = true;
  });
  let snapshot;
  await test('welcome and housekeeping replies do not prepare or save canonical interview evidence', async () => {
    snapshot = await guide.prepareProjectGuide('owner', source, 'welcome');
    snapshot = await guide.executeProjectGuide('owner', source, snapshot, { action: 'answer', requestId: 'setup-help', questionId: snapshot.currentQuestion.id, text: 'How do I upload more photographs?' });
    assert.equal(canonical, null); assert.equal(calls.length, 0); assert.equal(snapshot.guide.phase, 'guide');
  });
  await test('explicit natural start prepares podcast canonical state but never saves setup speech as an answer', async () => {
    planAction = 'start_interview';
    const start = { action: 'answer', requestId: 'natural-start', questionId: snapshot.currentQuestion.id, text: 'Yes, start the interview.' };
    const beforeCommit = structuredClone(snapshot);
    snapshot = await guide.executeProjectGuide('owner', source, snapshot, start);
    assert.equal(snapshot.guide.phase, 'interview'); assert.equal(canonical.conversationStyle, 'podcast'); assert.equal(canonical.turns.length, 0);
    assert.equal(snapshot.guide.remainingQuestionCount, null, 'room questions are not prepared yet');
    assert.equal(await guide.executeProjectGuide('owner', source, snapshot, start), snapshot, 'exact receipt replay does not begin twice');
    await assert.rejects(guide.executeProjectGuide('owner', source, snapshot, { ...start, text: 'Changed payload' }));
    const version = canonical.version, callCount = calls.length;
    snapshot = await guide.executeProjectGuide('owner', source, beforeCommit, start);
    assert.equal(snapshot.guide.phase, 'interview'); assert.equal(canonical.version, version); assert.equal(calls.length, callCount, 'lost live receipt recovers the committed start');
    await assert.rejects(guide.executeProjectGuide('owner', source, beforeCommit, { ...start, text: 'Changed payload' }), /different content/);
    planAction = 'none';
  });
  await test('interview answer dispatch preserves exact evidence, modality, question and selected photograph', async () => {
    const questionId = snapshot.currentQuestion.id;
    snapshot = await guide.executeProjectGuide('owner', source, snapshot, { action: 'answer', requestId: 'canonical-answer', questionId, text: 'We wanted a quiet room for reading.', inputModality: 'text', selectedImageId: 'tagged' });
    assert.equal(canonical.turns.length, 1); assert.equal(canonical.turns[0].text, 'We wanted a quiet room for reading.');
    assert.equal(canonical.turns[0].inputModality, 'text'); assert.equal(canonical.turns[0].selectedImageId, 'tagged'); assert.equal(snapshot.guide.answeredCount, 1);
  });
  await test('saved upload/tag changes refresh active interview metadata without changing its question or canonical version', async () => {
    const photos = structuredClone(project.images), before = structuredClone(snapshot), saved = JSON.stringify(canonical), callCount = calls.length;
    project.images.push({ id: 'new-upload', inclusion: 'INCLUDED', roomId: 'room', noProducts: false, _count: { tags: 2 } });
    Object.assign(project.images.find(image => image.id === 'unsorted'), { roomId: 'room', _count: { tags: 1 } });
    const request = command('refresh', 'saved-photo-refresh');
    snapshot = await guide.executeProjectGuide('owner', source, snapshot, request);
    assert.deepEqual([snapshot.guide.photoCount, snapshot.guide.taggedPhotoCount, snapshot.guide.reviewedPhotoCount, snapshot.guide.sortedPhotoCount, snapshot.guide.unreviewedPhotoCount], [4,3,4,4,0]);
    assert.equal(snapshot.version, before.version); assert.equal(snapshot.status, before.status);
    assert.equal(JSON.stringify(snapshot.currentQuestion), JSON.stringify(before.currentQuestion));
    assert.equal(JSON.stringify(snapshot.state.native), JSON.stringify(before.state.native));
    assert.notEqual(snapshot.sourceRefs[0].version, before.sourceRefs[0].version);
    assert.equal(JSON.stringify(canonical), saved); assert.equal(calls.length, callCount);
    assert.equal(await guide.executeProjectGuide('owner', source, snapshot, request), snapshot);
    await assert.rejects(guide.executeProjectGuide('owner', source, snapshot, { ...request, guideAction: 'return_guide' }), /different content/);
    project.images = photos;
  });
  await test('return to guide and restart request preserve canonical answers and only request UI confirmation', async () => {
    const saved = structuredClone(canonical);
    snapshot = await guide.executeProjectGuide('owner', source, snapshot, command('return_guide', 'return'));
    snapshot = await guide.executeProjectGuide('owner', source, snapshot, command('start_over', 'confirm-restart'));
    assert.equal(snapshot.guide.action, 'start_over'); assert.equal(JSON.stringify(canonical), JSON.stringify(saved));
  });
  await test('fresh-call resume recovers a canonical commit after its live snapshot write is lost', async () => {
    const fresh = await guide.prepareProjectGuide('owner', source, 'fresh-resume-welcome');
    assert.equal(fresh.state.native.canonical.version, canonical.version);
    const request = command('resume_interview', 'fresh-call-resume');
    snapshot = await guide.executeProjectGuide('owner', source, fresh, request);
    const version = canonical.version, callCount = calls.length;
    snapshot = await guide.executeProjectGuide('owner', source, fresh, request);
    assert.equal(snapshot.guide.phase, 'interview'); assert.equal(snapshot.currentQuestion.id, canonical.activeQuestionId);
    assert.equal(canonical.version, version); assert.equal(calls.length, callCount);
    await assert.rejects(guide.executeProjectGuide('owner', source, fresh, { ...request, guideAction: 'start_over' }), /different content/);
  });
  await test('common adapter replays a committed guide skip before validating the now-changed question', async () => {
    const request = { action: 'skip', requestId: 'guide-move-on-retry', questionId: snapshot.currentQuestion.id };
    snapshot = await adapters.executeLiveCommand('owner', source, snapshot, request);
    assert.notEqual(snapshot.currentQuestion.id, request.questionId);
    const version = canonical.version, callCount = calls.length;
    assert.equal(await adapters.executeLiveCommand('owner', source, snapshot, request), snapshot);
    assert.equal(canonical.version, version); assert.equal(calls.length, callCount);
    await assert.rejects(adapters.executeLiveCommand('owner', source, snapshot, { ...request, questionId: snapshot.currentQuestion.id }), /different speech/);
  });
  await test('completed interview can append a real canonical detail without replacing earlier evidence', async () => {
    canonical.plan.filter(q => ['active','pending'].includes(q.status)).forEach(q => { q.status = 'skipped'; });
    canonical.status = 'finished'; canonical.roomsPrepared = true; canonical.activeQuestionId = null; canonical.pendingDecisionTurnId = null;
    snapshot = await guide.prepareProjectGuide('owner', source, 'completed-welcome');
    assert.equal(snapshot.guide.phase, 'complete'); const oldText = canonical.turns[0].text;
    snapshot = await guide.executeProjectGuide('owner', source, snapshot, command('add_more', 'additional-detail'));
    assert.equal(snapshot.guide.phase, 'interview'); assert.match(snapshot.currentQuestion.id, /^detail-/);
    snapshot = await guide.executeProjectGuide('owner', source, snapshot, { action: 'answer', requestId: 'detail-answer', questionId: snapshot.currentQuestion.id, text: 'The window seat is the detail I wanted to add.' });
    assert.equal(canonical.turns[0].text, oldText); assert.equal(canonical.turns.at(-1).text, 'The window seat is the detail I wanted to add.');
    assert.equal(snapshot.guide.phase, 'complete');
  });
  await test('a completed-guide anecdote is offered verbatim for confirmation without becoming evidence until accepted', async () => {
    const anecdote = 'We moved the kitchen wall after the client showed us her grandmother’s table.';
    const before = JSON.stringify(canonical.turns); planAction = 'add_more'; planDetail = anecdote;
    const beforeCommit = structuredClone(snapshot), request = { action: 'answer', requestId: 'offered-detail', questionId: snapshot.currentQuestion.id, text: `One more thing. ${anecdote}` };
    snapshot = await guide.executeProjectGuide('owner', source, snapshot, request);
    assert.equal(JSON.stringify(canonical.turns), before, 'guide utterance never automatically becomes evidence');
    assert.equal(snapshot.guide.offeredDetail.text, anecdote);
    assert.equal(snapshot.guide.offeredDetail.questionId, snapshot.currentQuestion.id);
    const version = canonical.version, questionCount = canonical.plan.length;
    snapshot = await guide.executeProjectGuide('owner', source, beforeCommit, request);
    assert.equal(canonical.version, version); assert.equal(canonical.plan.length, questionCount, 'lost live receipt cannot append a second detail question');
    assert.equal(snapshot.guide.offeredDetail.text, anecdote);
    const offered = snapshot.guide.offeredDetail;
    snapshot = await guide.executeProjectGuide('owner', source, snapshot, { action: 'answer', requestId: 'confirmed-offered-detail', questionId: offered.questionId, text: offered.text, inputModality: 'text' });
    assert.equal(canonical.turns.at(-1).text, anecdote); assert.equal(snapshot.guide.offeredDetail, undefined);
    planAction = 'none'; planDetail = undefined;
  });
  await test('a fabricated model detail cannot be offered as designer text', async () => {
    planAction = 'add_more'; planDetail = 'Invented project detail.';
    snapshot = await guide.executeProjectGuide('owner', source, snapshot, { action: 'answer', requestId: 'reject-fabricated-detail', questionId: snapshot.currentQuestion.id, text: 'I want to add something.' });
    assert.equal(snapshot.guide.offeredDetail, undefined);
    planAction = 'none'; planDetail = undefined;
  });
  await test('legacy-only answers remain untouched and resume hands off to their existing workspace', async () => {
    canonical = null; legacy = [{ answer: 'Saved legacy answer.' }, { answer: 'Another saved answer.' }]; calls = [];
    snapshot = await guide.prepareProjectGuide('owner', source, 'legacy-welcome');
    assert.equal(snapshot.guide.legacyInterview, true); assert.equal(snapshot.guide.answeredCount, 2); assert.equal(snapshot.guide.stage, 'interview_resume');
    snapshot = await guide.executeProjectGuide('owner', source, snapshot, command('resume_interview', 'legacy-resume'));
    assert.equal(snapshot.guide.phase, 'guide'); assert.equal(snapshot.guide.action, 'resume_interview'); assert.equal(calls.length, 0); assert.equal(canonical, null);
  });
  await test('an empty prepared plan is a new interview rather than saved-answer progress', async () => {
    legacy = []; canonical = controller.createGuidedSession('project', preparation(), 'empty-prepared');
    project.images = project.images.filter(i => i.id === 'tagged');
    const context = await guide.readProjectGuideContext('owner', source);
    assert.equal(context.answeredCount, 0); assert.equal(context.stage, 'interview_new');
  });
  console.log(`${count} project guide adapter checks passed; provider/model/database boundaries are synthetic.`);
})().catch(error => { console.error(error); process.exitCode = 1; });
