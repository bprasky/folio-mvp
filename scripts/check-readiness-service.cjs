// Real service orchestration with inert source, storage, Redis and AI adapters.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, mocks) {
  const exports = {};
  const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(js, { exports, require: name => {
    if (!(name in mocks)) throw new Error(`Unmocked dependency: ${name}`);
    return mocks[name];
  }, console, structuredClone, process: { env: { NODE_ENV: 'test' } } });
  return exports;
}
async function main() {
  let enabled = true, sources = [], stored = [], events = [], saves = [], evaluations = 0, modelHistory = [], mutationHistory = [], work = [];
  let workspace = { id: null, name: 'Studio', canWriteCampaigns: false }, budget = true, mutateAfterEvaluate;
  let useRealEngine = false, answerCalls = 0;
  const engine = load('src/lib/publishing-studio/readiness/engine.ts', {});
  const policy = 'test-policy';
  const source = { key: 'project:p1', origin: 'project', title: 'Project One', fingerprint: 'source-a', projectIds: ['p1'], evidence: [], images: [] };
  const fixture = () => ({ id: 'candidate-1', version: 1, sourceVersion: 'source-a', sourceKey: source.key, policy,
    designerId: 'owner', organizationId: null, projectIds: ['p1'], source, evidence: [], blockers: [], claims: [],
    readiness: 'ready', dismissed: false, dimensions: {}, score: 80, reasons: [], visuals: [{ id: 'image', url: 'photo', reason: 'proof' }],
    draft: { headline: 'A supported decision', caption: 'A supported caption', slides: [] } });
  class Conflict extends Error {}
  const service = load('src/lib/publishing-studio/readiness/service.ts', {
    'server-only': {}, '@/lib/prisma': { prisma: {} }, '@/lib/rateLimit': { checkRateLimit: async () => ({ success: budget }) }, '@upstash/redis': { Redis: class {} },
    './types': { READINESS_POLICY: policy, DISMISSAL_REASONS: ['already_shared', 'not_accurate'] },
    './sources': { readinessEnabled: () => enabled, sourceVersion: s => s.fingerprint,
      loadCandidateSources: async () => ({ workspace: structuredClone(workspace), sources: structuredClone(sources) }) },
    './engine': { selectCandidates: items => items.filter(c => !c.dismissed && !c.confirmedPublishedAt && ['ready','quick'].includes(c.readiness)),
      evaluateCandidate: (candidate, history = []) => { mutationHistory = history; return useRealEngine ? engine.evaluateCandidate(candidate, history) : { ...candidate, readiness: candidate.blockers.length ? 'quick' : candidate.readiness }; },
      answerBlocker: (candidate, id, answer) => { answerCalls++; return useRealEngine ? engine.answerBlocker(candidate, id, answer) : { ...structuredClone(candidate), evidence: [...candidate.evidence, { id, text: answer, source: 'designer_answer' }] }; } },
    './evaluator': { evaluateSource: async (s, user, org, history) => { modelHistory = history; evaluations++; if (mutateAfterEvaluate) mutateAfterEvaluate(); return { ...fixture(), sourceVersion: s.fingerprint }; } },
    './store': { CandidateConflictError: Conflict, listStoredCandidates: async () => structuredClone(stored), listCandidateWork: async () => structuredClone(work),
      saveCandidate: async (candidate, expected, kind, payload, secondaryEvents = []) => { saves.push({ candidate: structuredClone(candidate), expected, kind, payload, secondaryEvents }); stored = [structuredClone(candidate)]; events.push(...secondaryEvents.map(event => ({ candidate, ...event, atomic: true }))); return candidate; },
      appendEvent: async (candidate, kind, payload, id) => events.push({ candidate, kind, payload, id }) },
  });
  sources = [source]; stored = [fixture()];
  const initial = await service.listReadiness('owner');
  assert.equal(initial.candidates.length, 1);
  assert.equal(evaluations + saves.length + events.length, 0, 'browsing cannot generate, persist, or record impressions');
  enabled = false;
  await assert.rejects(service.listReadiness('owner'), e => e.status === 404);
  enabled = true;
  workspace = { id: 'other-workspace', name: 'Other', canWriteCampaigns: false };
  await assert.rejects(service.listReadiness('owner'), e => e.status === 403);
  workspace = { id: null, name: 'Studio', canWriteCampaigns: false };
  await assert.rejects(service.currentCandidate('owner', 'foreign'), e => e.status === 404);
  await assert.rejects(service.currentCandidate('owner', 'candidate-1', 2, 'source-a'), Conflict);
  sources = [{ ...source, fingerprint: 'changed' }];
  await assert.rejects(service.changeCandidate('owner', 'candidate-1', { version: 1, sourceVersion: 'source-a', action: 'dismiss' }), Conflict);
  assert.equal(saves.length, 0);
  sources = [source];
  const change = { version: 1, sourceVersion: 'source-a', action: 'edit', caption: 'My exact explanation.' };
  const edited = await service.changeCandidate('owner', 'candidate-1', change);
  assert.equal(edited.version, 2);
  assert.equal(edited.evidence[0].source, 'designer_answer');
  assert.equal(edited.evidence[0].text, change.caption);
  assert.equal(saves[0].expected, 1);
  assert.equal(saves[0].kind, 'edited');
  assert.equal(edited.confirmedPublishedAt, undefined, 'editing must never imply social publication');
  useRealEngine = true;
  const pendingFixture = fixture();
  pendingFixture.thesis = pendingFixture.draft.headline;
  pendingFixture.dimensions = Object.fromEntries(Object.keys(engine.WEIGHTS).map(key => [key, 1]));
  pendingFixture.penalties = Object.fromEntries(Object.keys(engine.PENALTY_CAPS).map(key => [key, 0]));
  pendingFixture.evidence = [{ id: 'source', projectId: 'p1', tier: 'direct', source: 'published_prose', text: `${pendingFixture.thesis} ${pendingFixture.draft.caption}` }];
  pendingFixture.claims = [{ text: pendingFixture.draft.caption, evidenceIds: ['source'] }];
  pendingFixture.visuals = [{ ...pendingFixture.visuals[0], projectId: 'p1', approved: true, width: 1080, height: 1350, technical: 1, relevance: 1, aesthetic: 1, crop: 1 }];
  pendingFixture.draft.credits = { designer: 'Designer', photographer: null };
  pendingFixture.blockers = [{ id: 'credit', kind: 'credit', question: 'Who photographed this?', evidenceIds: [], options: ['Photographer'] }];
  stored = [engine.evaluateCandidate(pendingFixture)];
  const pendingAnswer = { blockerId: 'credit', text: ' Photo' };
  let drafted = await service.changeCandidate('owner', 'candidate-1', { version: 1, sourceVersion: 'source-a', action: 'draft', pendingAnswer });
  assert.deepEqual(structuredClone(drafted.draft.pendingAnswer), pendingAnswer);
  assert.equal(drafted.readiness, 'quick');
  assert.equal(drafted.blockers[0].answer, undefined);
  assert.equal(drafted.draft.credits.photographer, null);
  assert.equal(answerCalls, 0, 'saving a partial answer never submits it to the answer engine');
  assert.equal(drafted.evidence.length, 1, 'partial text is not attributed as confirmed evidence');
  assert.equal(saves.at(-1).kind, 'edited', 'only explicit draft save counts as started work');
  drafted = await service.changeCandidate('owner', 'candidate-1', { version: 2, sourceVersion: 'source-a', action: 'edit', caption: drafted.draft.caption });
  assert.deepEqual(structuredClone(drafted.draft.pendingAnswer), pendingAnswer, 'normal editing preserves the saved answer buffer');
  const writesBeforeInvalid = saves.length;
  for (const pendingAnswer of [{ blockerId: 'foreign', text: 'Answer' }, { blockerId: 'credit', text: 'x'.repeat(2201) }, { blockerId: 'credit', text: ' ' }]) {
    await assert.rejects(service.changeCandidate('owner', 'candidate-1', { version: 3, sourceVersion: 'source-a', action: 'draft', pendingAnswer }));
  }
  await assert.rejects(service.changeCandidate('owner', 'candidate-1', { version: 3, sourceVersion: 'source-a', action: 'answer', blockerId: 'credit', answer: 'Not an offered option' }));
  assert.equal(saves.length, writesBeforeInvalid);
  assert.deepEqual(structuredClone(stored[0].draft.pendingAnswer), pendingAnswer, 'failed submission retains the partial answer');
  drafted = await service.changeCandidate('owner', 'candidate-1', { version: 3, sourceVersion: 'source-a', action: 'draft', pendingAnswer: null });
  assert.equal(drafted.draft.pendingAnswer, undefined);
  drafted = await service.changeCandidate('owner', 'candidate-1', { version: 4, sourceVersion: 'source-a', action: 'draft', pendingAnswer });
  const completed = await service.changeCandidate('owner', 'candidate-1', { version: 5, sourceVersion: 'source-a', action: 'answer', blockerId: 'credit', answer: 'Photographer' });
  assert.equal(completed.draft.pendingAnswer, undefined);
  assert.equal(completed.blockers[0].answer, 'Photographer');
  assert.equal(completed.draft.credits.photographer, 'Photographer');
  assert.equal(completed.readiness, 'ready', 'only explicit valid submission lets the existing engine resolve the blocker');
  await assert.rejects(service.changeCandidate('owner', 'candidate-1', { version: 6, sourceVersion: 'source-a', action: 'draft', pendingAnswer }));
  useRealEngine = false;
  stored = [fixture()];
  await assert.rejects(service.changeCandidate('owner', 'candidate-1', { ...change, imageIds: ['foreign-image'] }));
  await assert.rejects(service.changeCandidate('owner', 'candidate-1', { ...change, imageIds: ['image','image'] }));
  stored = [{ ...fixture(), readiness: 'quick' }];
  await assert.rejects(service.changeCandidate('owner', 'candidate-1', { version: 1, sourceVersion: 'source-a', action: 'published' }), e => e.status === 409);
  stored = [{ ...fixture(), dismissed: true }];
  await assert.rejects(service.recordCandidateView('owner', 'candidate-1', 1, 'source-a', 'shown', 'view-id'));
  stored = [fixture()];
  await service.recordCandidateView('owner', 'candidate-1', 1, 'source-a', 'shown', 'view-id');
  assert.equal(events.at(-1).id, 'view:owner:view-id');
  const published = await service.changeCandidate('owner', 'candidate-1', { version: 1, sourceVersion: 'source-a', action: 'published' });
  assert.ok(published.confirmedPublishedAt);
  assert.equal(saves.at(-1).kind, 'published');
  await assert.rejects(service.changeCandidate('owner', 'candidate-1', { version: 2, sourceVersion: 'source-a', action: 'restore' }));
  stored = []; saves = []; events = []; budget = false;
  await assert.rejects(service.refreshReadiness('owner'), e => e.status === 429);
  assert.equal(evaluations, 0);
  budget = true; mutateAfterEvaluate = () => { sources = [{ ...source, fingerprint: 'changed' }]; };
  await assert.rejects(service.refreshReadiness('owner'), Conflict);
  assert.equal(saves.length, 0, 'provider result cannot persist after source changes');
  mutateAfterEvaluate = undefined; sources = [source];
  const refreshed = await service.refreshReadiness('owner');
  assert.equal(refreshed.evaluated, 1);
  assert.equal(saves[0].kind, 'generated');
  assert.ok(events.some(event => event.kind === 'scored'));
  assert.ok(events.some(event => event.kind === 'ready'));
  assert.ok(events.filter(event => ['scored', 'ready'].includes(event.kind)).every(event => event.atomic), 'lifecycle events belong to candidate save transaction');
  const before = evaluations;
  await service.refreshReadiness('owner');
  assert.equal(evaluations, before, 'identical persisted source is not regenerated');
  const secondSource = { ...source, key: 'project:p2', projectIds: ['p2'], fingerprint: 'second' };
  const second = { ...fixture(), id: 'candidate-2', sourceKey: secondSource.key, sourceVersion: 'second', projectIds: ['p2'] };
  const stale = { ...fixture(), id: 'stale', sourceKey: 'gone', sourceVersion: 'old' };
  sources = [{ ...source, fingerprint: 'changed' }, secondSource]; stored = [fixture(), second, stale];
  await service.refreshReadiness('owner');
  assert.deepEqual(Array.from(modelHistory, c => c.id), ['candidate-2'], 'model history excludes self and stale/out-of-corpus sources');
  sources = [source, secondSource]; stored = [fixture(), second, stale];
  await service.changeCandidate('owner', 'candidate-1', change);
  assert.deepEqual(Array.from(mutationHistory, c => c.id), ['candidate-2'], 'edits recheck current other stories');
  stored = [fixture(), second, stale];
  await service.changeCandidate('owner', 'candidate-1', { version: 1, sourceVersion: 'source-a', action: 'answer', blockerId: 'test', answer: 'A direct answer' });
  assert.deepEqual(Array.from(mutationHistory, c => c.id), ['candidate-2'], 'answers recheck current other stories');
  sources = [source]; stored = [fixture()];
  work = [
    { candidate: { ...fixture(), id: 'started', readiness: 'quick' }, lastWorkedAt: '2026-09-22T12:00:00Z', exportedAt: null },
    { candidate: { ...fixture(), id: 'stale', sourceVersion: 'older' }, lastWorkedAt: '2026-09-21T12:00:00Z', exportedAt: null },
    { candidate: { ...fixture(), id: 'exported' }, lastWorkedAt: null, exportedAt: '2026-09-22T13:00:00Z' },
    { candidate: { ...fixture(), id: 'stale-export', sourceVersion: 'older' }, lastWorkedAt: null, exportedAt: '2026-09-21T13:00:00Z' },
    { candidate: { ...fixture(), id: 'dismissed', dismissed: true }, lastWorkedAt: '2026-09-23T00:00:00Z', exportedAt: null },
  ].map(item => ({ ...item, isCurrent: true }));
  const projection = await service.listReadiness('owner');
  assert.equal(projection.projects.length, 1);
  assert.equal(projection.projects[0].title, 'Project One');
  sources = [source, { ...source }, { ...source, key: 'room:p1:r1', origin: 'room', title: 'Room title' }];
  const labels = (await service.listReadiness('owner')).projects;
  assert.equal(labels.length, 1, 'project labels deduplicate and exclude room candidates');
  assert.equal(labels[0].title, 'Project One');
  assert.equal(projection.inProgress.length, 2);
  assert.equal(projection.inProgress[0].candidate.id, 'started');
  assert.equal(projection.inProgress[0].needsReview, false);
  assert.equal(projection.inProgress[1].needsReview, true, 'started stale work remains readable without being ready');
  assert.equal(projection.exports[0].canDownload, true);
  assert.equal(projection.exports[1].canDownload, false, 'stale export history is not a downloadable current package');
  assert.equal(projection.exports[1].needsReview, true);
  work = [
    { candidate: { ...fixture(), version: 2, confirmedPublishedAt: '2026-09-22T14:00:00Z' }, isCurrent: true, lastWorkedAt: '2026-09-22T12:00:00Z', exportedAt: null },
    { candidate: fixture(), isCurrent: false, lastWorkedAt: null, exportedAt: '2026-09-22T13:00:00Z' },
  ];
  const afterPublication = await service.listReadiness('owner');
  assert.equal(afterPublication.inProgress.length, 1, 'publication is saved work without implying a downloaded current version');
  assert.equal(afterPublication.exports.length, 1, 'published successor retains actual exported snapshot');
  assert.equal(afterPublication.exports[0].candidate.version, 1);
  assert.equal(afterPublication.exports[0].needsReview, true);
  assert.equal(afterPublication.exports[0].canDownload, false, 'historical version is read-only even when source fingerprint matches');
  work = [work[0]];
  sources = [];
  const publicationOnly = await service.listReadiness('owner');
  assert.equal(publicationOnly.inProgress.length, 1, 'authorized publication-only work survives missing/private source');
  assert.ok(publicationOnly.inProgress[0].candidate.confirmedPublishedAt);
  assert.equal(publicationOnly.inProgress[0].needsReview, true);
  assert.equal(publicationOnly.exports.length, 0, 'recording publication does not fabricate an export');
  console.log('PASS readiness service: read-only browsing, auth/staleness checks, attributed edits, publication, lifecycle events, and truthful started/exported work projections.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
