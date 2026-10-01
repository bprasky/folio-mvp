// Adapter dispatch + real bio/org/collaboration writers. No credentials, network or real database.
// Native guided/Spotlight/expertise/story engines also have their own persistence suites.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { memoryDatabase } = require('./core/memory-db.cjs');
const root = path.resolve(__dirname, '..');
const db = memoryDatabase();
const originalRaw = db.$queryRaw;
db.$queryRaw = async (sql, ...values) => /FOR UPDATE/.test(sql.join('')) ? [] : originalRaw(sql, ...values);
const calls = []; const cache = new Map();
let guided, spotlight, expertise, story, latestBio = null, routeActor = 'owner';
const env = { NEXT_PUBLIC_FLAG_GUIDED_INTERVIEW: '1' };
const q = id => ({ id, text: `Exact question ${id}?`, sourceImageIds: [] });
const mocks = {
  'server-only': {}, 'next/cache': { revalidatePath: path => calls.push(['revalidate', path]) },
  'next/server': { NextResponse: { json: (body, init) => ({ status: init?.status || 200, json: async () => body }) } },
  'next-auth': { getServerSession: async () => ({ user: { id: routeActor } }) },
  '@/app/api/auth/[...nextauth]/options': { authOptions: {} },
  '@/lib/prisma': { prisma: db },
  '@/lib/live-interview/store': { getLatestLiveSession: async () => latestBio },
  '@/lib/authz/access': { assertProjectWrite: async (actor, id) => {
    const project = await db.project.findUnique({ where: { id } });
    if (project ? project.ownerId !== actor && project.designerId !== actor : actor !== 'owner') throw Error('Forbidden');
  } },
  '@/lib/spotlight/legacyBoundary': { assertLegacyInterviewAllowed: id => { if (id === 'protected') throw Error('protected Spotlight'); } },
  '@/lib/interview/guided/service': {
    getGuidedSession: async () => guided,
    runGuidedCommand: async (_id, _actor, command) => {
      calls.push(['guided', structuredClone(command)]);
      if (command.action === 'answer') { guided.turns.push({ id: command.requestId, questionId: command.questionId, questionText: guided.plan[0].text, text: command.text, kind: 'answer' }); guided.version++; guided.activeQuestionId = 'g2'; }
      return structuredClone(guided);
    },
  },
  '@/lib/spotlight/service': { runSpotlight: async (_id, _actor, command) => {
    calls.push(['spotlight', structuredClone(command)]);
    if (command.action === 'accept') { assert.equal(command.questionVersion, 7); assert.equal(command.selectionVersion, 3); spotlight.questions[0].currentAnswer = { acceptedText: command.text }; spotlight.questions[0].currentAnswerNumber = 1; spotlight.questions[0].stateVersion++; }
    return structuredClone(spotlight);
  } },
  '@/lib/publishing-studio/expertise/service': {
    readExpertise: async () => structuredClone(expertise), publicExpertise: async () => null,
    changeExpertise: async (_actor, _id, command) => { calls.push(['expertise', command]); expertise.version++; expertise.session.answers.push({ questionId: 'e1', text: command.text }); expertise.session.nextQuestion = null; return structuredClone(expertise); },
  },
  '@/lib/publishing-studio/story-service': {
    readStory: async () => structuredClone(story), publicStory: async () => null,
    changeStory: async (_actor, _id, command) => { assert.equal(command.revision, story.revision); story.revision++; story.answers = command.answers; return structuredClone(story); },
  },
  '@/lib/permissions': {
    canPublishFromOrg: async () => ({ ok: true }),
    getUserOrgMemberships: actor => db.organizationUser.findMany({ where: { userId: actor, isActive: true } }),
    isOrgAdmin: (members, org) => members.some(m => m.organizationId === org && ['OWNER', 'ADMIN'].includes(m.role)),
  },
  '@/lib/designer-bio/questions': {},
  '@/lib/collaboration/auth': { assertCollaborationStoryEdit: async (actor, id) => {
    const saved = await db.collaborationStory.findUnique({ where: { id } });
    if (saved.designerUserId === actor) return { role: 'designer' };
    if (await db.organizationUser.findFirst({ where: { userId: actor, organizationId: saved.vendorOrgId, isActive: true } })) return { role: 'vendor' };
    throw Error('Forbidden');
  } },
};
const bioQuestions = { getBlankSlateQuestions: () => [{ id: 'b1', question: 'Where did you begin?' }, { id: 'b2', question: 'What shaped your practice?' }], generateWebsiteContextQuestions: async () => [], generateFollowUpQuestions: async () => [{ id: 'f1', question: 'Which decision made that clear?' }] };
function load(file) {
  const full = path.resolve(root, file); if (cache.has(full)) return cache.get(full).exports;
  const compiled = { exports: {} }; cache.set(full, compiled);
  const code = ts.transpileModule(fs.readFileSync(full, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const localRequire = name => {
    if (name.endsWith('/questions') && full.includes('designer-bio')) return bioQuestions;
    if (name === './questions/generateRound2') return { generateRound2Questions: async () => [{ id: 'round2', prompt: 'What did the collaboration make possible?' }], isRound2Complete: answers => answers.length >= 3 };
    if (name === './questions/generateRound3') return { generateRound3Questions: async () => [{ id: 'round3', prompt: 'How did that detail come together?' }], isRound3Complete: answers => answers.length >= 2 };
    if (mocks[name]) return mocks[name];
    const target = name.startsWith('@/') ? path.join(root, 'src', name.slice(2)) : name.startsWith('.') ? path.resolve(path.dirname(full), name) : null;
    if (target) return load(path.relative(root, target + '.ts'));
    return require(name);
  };
  vm.runInNewContext(`(function(require,module,exports){${code}\n})`, { process: { env }, Date, Error, Set, Map, structuredClone, console })(localRequire, compiled, compiled.exports);
  return compiled.exports;
}
const adapter = load('src/lib/live-interview/adapters.ts');
const answer = (source, previous, text, id = 'receipt-0001', questionId = previous.currentQuestion?.id) => adapter.executeLiveCommand('owner', source, previous, { action: 'answer', requestId: id, questionId, text });
(async () => {
  await db.user.create({ data: { id: 'owner', name: 'Creator', role: 'DESIGNER', accountStatus: 'APPROVED' } });
  await db.user.create({ data: { id: 'other', accountStatus: 'APPROVED' } });
  await db.organization.create({ data: { id: 'org', name: 'Studio' } });
  await db.organizationUser.create({ data: { organizationId: 'org', userId: 'owner', role: 'OWNER', isActive: true } });
  guided = { id: 'guided-id', version: 4, status: 'active', plan: [q('g1'), q('g2')], activeQuestionId: 'g1', contextFingerprint: 'source-v1', turns: [] };
  let source = { kind: 'project', id: 'project' }; let saved = await adapter.prepareLiveInterview('owner', source, 'start-0001');
  saved = await answer(source, saved, 'A quieter daily rhythm.'); assert.equal(guided.turns[0].questionText, 'Exact question g1?'); assert.equal(saved.currentQuestion.id, 'g2');
  assert.equal((await answer(source, saved, 'A quieter daily rhythm.', 'receipt-0001', 'g1')).version, saved.version, 'receipt replay returns saved turn');
  await assert.rejects(() => answer(source, saved, 'Changed replay.', 'receipt-0001', 'g1'), /already used/);
  await assert.rejects(() => adapter.prepareLiveInterview('owner', { kind: 'project', id: 'protected' }, 'start-0002'), /protected Spotlight/);
  spotlight = { ordinary: [], questions: [{ id: 's1', wording: 'Why did you choose this selected piece?', spotlightId: 'selected', eligible: true, questionVersion: 7, selectionVersion: 3, stateVersion: 2, currentAnswerNumber: null, currentAnswer: null }], spotlights: [{ id: 'selected', roomId: 'room' }] };
  source = { kind: 'spotlight', id: 'project' }; saved = await adapter.prepareLiveInterview('owner', source, 'spotlight-start'); saved = await answer(source, saved, 'It makes the corner useful.');
  assert.equal(saved.status, 'ready'); assert.equal(spotlight.questions[0].currentAnswer.acceptedText, 'It makes the corner useful.');
  expertise = { version: 3, revisionNumber: 1, opportunity: { evidence: [] }, session: { nextQuestion: { id: 'e1', text: 'How do the two choices compare?', evidenceIds: [] }, answers: [], status: 'interview' } };
  source = { kind: 'expertise', id: 'real-story' }; saved = await adapter.prepareLiveInterview('owner', source, 'expertise-start'); saved = await answer(source, saved, 'Different daily routines.');
  assert.equal(saved.status, 'needs_review'); assert.equal(expertise.session.answers[0].text, 'Different daily routines.', 'next generation failure retains accepted evidence');
  story = { id: 'about-story', revision: 6, definition: { questions: [{ id: 'a1', prompt: 'What shapes your eye?' }, { id: 'a2', prompt: 'What detail do you notice first?' }] }, answers: [] };
  source = { kind: 'story', id: story.id }; saved = await adapter.prepareLiveInterview('owner', source, 'story-start'); const old = structuredClone(saved); saved = await answer(source, saved, 'The quality of daylight.');
  await answer(source, old, 'The quality of daylight.'); assert.equal(story.revision, 7, 'lost receipt retry does not duplicate canonical mutation'); assert.equal(saved.currentQuestion.id, 'a2');
  source = { kind: 'designer_bio', id: 'owner' }; saved = await adapter.prepareLiveInterview('owner', source, 'bio-start');
  saved = await answer(source, saved, 'The full, unshortened beginning.'); let bio = await db.designerBio.findUnique({ where: { userId: 'owner' } });
  assert.equal(bio.interviewAnswers[0].question, 'Where did you begin?'); assert.equal(bio.interviewAnswers[0].answer, 'The full, unshortened beginning.');
  saved = await adapter.executeLiveCommand('owner', source, saved, { action: 'correct', questionId: 'b1', text: 'A corrected beginning.', requestId: 'bio-correction' });
  bio = await db.designerBio.findUnique({ where: { userId: 'owner' } }); assert.equal(bio.interviewAnswers.length, 1); assert.equal(bio.interviewAnswers[0].answer, 'A corrected beginning.');
  await assert.rejects(() => adapter.authorizeLiveSource('other', source), /your account/);
  env.FOLIO_LIVE_INTERVIEWS = '1';
  latestBio = { payload: { snapshot: { source, state: { questions: [{ id: 'b2', text: 'The exact live wording?', sourceImageIds: [] }] } } } };
  const retained = await load('src/lib/designer-bio/interview-service.ts').prepareBioQuestions('owner', 'base');
  assert.equal(retained[0].question, 'The exact live wording?', 'text reload reuses privately persisted live wording');
  env.FOLIO_LIVE_INTERVIEWS = undefined;
  source = { kind: 'org_bio', id: 'org' }; saved = await adapter.prepareLiveInterview('owner', source, 'org-start'); saved = await answer(source, saved, 'Our first shared studio.');
  const org = await db.orgBioInterview.findUnique({ where: { organizationId: 'org' } }); assert.equal(org.conversationalAnswers.founding, 'Our first shared studio.');
  await assert.rejects(() => adapter.authorizeLiveSource('other', source), /admin access/);
  await db.collaborationStory.create({ data: { id: 'collab', slug: 'collab', vendorOrgId: 'org', designerUserId: 'other', status: 'ACCEPTED' } });
  source = { kind: 'collaboration', id: 'collab', round: 1 }; saved = await adapter.prepareLiveInterview('owner', source, 'collab-start'); const originalQuestion = saved.currentQuestion.id;
  saved = await answer(source, saved, 'We worked together on a home.'); const collab = await db.collaborationStory.findUnique({ where: { id: 'collab' } });
  assert.equal(collab.vendorRound1.responses[0].questionId, originalQuestion); assert.equal(collab.vendorRound1.responses[0].answer, 'We worked together on a home.'); assert.equal(collab.designerRound1, null);
  const secondRound = { ...source, round: 2 };
  const preparedSecond = await adapter.prepareLiveInterview('owner', secondRound, 'collab-round2-start');
  await answer(secondRound, preparedSecond, 'The shared prototype resolved it.', 'collab-round2-answer');
  assert.equal((await db.collaborationStory.findUnique({ where: { id: 'collab' } })).vendorRound2.responses[0].answer, 'The shared prototype resolved it.', 'first round2 answer uses post-preparation canonical version');
  const paused = await adapter.executeLiveCommand('owner', source, saved, { action: 'pause', requestId: 'pause-0001' }); assert.equal(paused.status, 'paused');
  await assert.rejects(() => adapter.executeLiveCommand('owner', source, saved, { action: 'finish', requestId: 'finish-0001' }), /Confirm finishing/);
  const finished = await adapter.executeLiveCommand('owner', source, saved, { action: 'finish', requestId: 'finish-0002', confirmPartial: true }); assert.equal(finished.status, 'finished');
  assert.equal((await db.collaborationStory.findUnique({ where: { id: 'collab' } })).vendorRound1.responses.length, 1, 'controls are not creator evidence');
  await db.project.create({ data: { id: 'project', title: 'Source project', ownerId: 'owner', isPublic: false } });
  await db.projectPost.create({ data: { projectId: 'project', slug: 'source', status: 'DRAFT' } });
  await assert.rejects(() => adapter.resolveMediaSource('owner', { sourceType: 'spotlight', sourceId: 'project' }, 'export'), /Publish and review/);
  await db.project.update({ where: { id: 'project' }, data: { isPublic: true } });
  await db.projectPost.update({ where: { projectId: 'project' }, data: { status: 'PUBLISHED', publishedAt: new Date() } });
  const eligibleSpotlight = await adapter.resolveMediaSource('owner', { sourceType: 'spotlight', sourceId: 'project' }, 'export');
  assert.equal(eligibleSpotlight.destination, '/project/project', 'eligible source destination still requires separate media-plan approval');
  spotlight.questions[0].currentAnswer.acceptedText = 'A later accepted answer.';
  const laterSpotlight = await adapter.resolveMediaSource('owner', { sourceType: 'spotlight', sourceId: 'project' }, 'export');
  assert.equal(laterSpotlight.recordingScopeVersion, eligibleSpotlight.recordingScopeVersion, 'source scope stays stable across legitimate accepted speech');
  assert.notEqual(laterSpotlight.version, eligibleSpotlight.version, 'approved plan is invalidated by changed canonical answer');
  spotlight.spotlights[0].selectionVersion = 9;
  assert.notEqual((await adapter.resolveMediaSource('owner', { sourceType: 'spotlight', sourceId: 'project' }, 'export')).recordingScopeVersion, laterSpotlight.recordingScopeVersion, 'selection changes invalidate captured scope');
  spotlight.questions[0].eligible = false;
  await assert.rejects(() => adapter.resolveMediaSource('owner', { sourceType: 'spotlight', sourceId: 'project' }, 'export'), /Publish and review/);
  await db.orgBioInterview.update({ where: { organizationId: 'org' }, data: { generatedAt: new Date(), fullBio: 'Generated biography.' } });
  await db.organization.update({ where: { id: 'org' }, data: { description: 'Public organization biography.' } });
  assert.equal((await adapter.resolveMediaSource('owner', { sourceType: 'org_bio', sourceId: 'org' }, 'export')).destination, '/org/org?tab=about');
  const contributionSource = { sourceType: 'collaboration', sourceId: 'collab' };
  assert.equal((await adapter.resolveMediaSource('owner', contributionSource, 'export')).destination, '/org/org?tab=about', 'vendor can publish their own perspective from their actual public org');
  await db.project.create({ data: { id: 'designer-project', title: 'Designer source', ownerId: 'other', isPublic: true } });
  await db.projectPost.create({ data: { projectId: 'designer-project', slug: 'designer-source', status: 'PUBLISHED', publishedAt: new Date() } });
  await db.collaborationStory.update({ where: { id: 'collab' }, data: { taggedProjectId: 'designer-project', status: 'INVITED', vendorRound1: null, vendorRound2: null,
    designerRound1: { responses: [{ questionId: 'd1', answer: 'My own perspective.' }] } } });
  const independent = await adapter.resolveMediaSource('other', contributionSource, 'export');
  assert.equal(independent.destination, '/project/designer-project', 'pending vendor participation cannot block own designer media');
  await db.collaborationStory.update({ where: { id: 'collab' }, data: { status: 'ROUND1_VENDOR', vendorRound1: { responses: [{ questionId: 'v1', answer: 'New vendor perspective.' }] } } });
  const vendorProgress = await adapter.resolveMediaSource('other', contributionSource, 'export');
  assert.equal(vendorProgress.version, independent.version, 'other-party progress does not invalidate own media approval');
  assert.equal(vendorProgress.recordingScopeVersion, independent.recordingScopeVersion, 'other-party progress does not invalidate own recording');
  await db.collaborationStory.update({ where: { id: 'collab' }, data: { designerRound1: { responses: [{ questionId: 'd1', answer: 'My corrected perspective.' }] } } });
  assert.notEqual((await adapter.resolveMediaSource('other', contributionSource, 'export')).version, independent.version, 'own corrections invalidate the approved media version');
  await db.user.create({ data: { id: 'outsider', accountStatus: 'APPROVED' } });
  await assert.rejects(() => adapter.resolveMediaSource('outsider', contributionSource, 'export'), /Forbidden/, 'a published linked project does not authorize a nonparticipant');
  await db.project.update({ where: { id: 'designer-project' }, data: { isPublic: false } });
  await assert.rejects(() => adapter.resolveMediaSource('other', contributionSource, 'export'), /Publish and review/, 'a draft tagged project is not a public media destination');
  await db.designerBio.create({ data: { userId: 'other', status: 'published', folioBio: 'An actual public designer biography.' } });
  assert.equal((await adapter.resolveMediaSource('other', contributionSource, 'export')).destination, '/profile/other?tab=about', 'own published profile works without a published tagged project');
  await db.collaborationStory.update({ where: { id: 'collab' }, data: { taggedProjectId: 'project' } });
  assert.equal((await adapter.resolveMediaSource('other', contributionSource, 'export')).destination, '/profile/other?tab=about', 'foreign linked project is not an authorization grant');
  const approve = load('src/app/api/collaboration/stories/[id]/approve/route.ts');
  const publish = load('src/app/api/collaboration/stories/[id]/publish/route.ts');
  const routeParams = { params: { id: 'collab' } };
  await db.collaborationStory.update({ where: { id: 'collab' }, data: { status: 'REVIEW', publishedAt: null, finalContent: { title: 'Joint article' } } });
  routeActor = 'other';
  assert.equal((await publish.POST({}, routeParams)).status, 400, 'joint publication still requires both approvals');
  assert.equal((await approve.POST({ json: async () => ({ approved: true }) }, routeParams)).status, 200);
  assert.equal((await publish.POST({}, routeParams)).status, 400, 'designer-only approval does not publish the joint article');
  routeActor = 'owner';
  const both = await approve.POST({ json: async () => ({ approved: true }) }, routeParams);
  assert.equal((await both.json()).bothApproved, true, 'actual existing approval route requires the second participant');
  assert.equal((await publish.POST({}, routeParams)).status, 200);
  await db.designerBio.update({ where: { userId: 'other' }, data: { status: 'draft' } });
  await assert.rejects(() => adapter.resolveMediaSource('other', contributionSource, 'export'), /Publish and review/, 'joint publication does not expose shared content through an independent recording source');
  await db.user.update({ where: { id: 'owner' }, data: { accountStatus: 'PENDING' } }); await assert.rejects(() => answer(source, saved, 'No longer permitted.', 'revoked-0001'), /Approved account/);
  console.log('PASS live adapters: all seven real source kinds dispatch; bio/org/vendor collaboration persist through actual shared writers; replay, exact wording, correction, partial finish, protected routing and revoked access. Native engine boundaries are doubled here; no provider/database isolation claim.');
})().catch(error => { console.error(error); process.exitCode = 1; });
