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
  let enabled = true, sources = [], stored = [], events = [], saves = [], evaluations = 0, modelHistory = [], mutationHistory = [];
  let workspace = { id: null, name: 'Studio', canWriteCampaigns: false }, budget = true, mutateAfterEvaluate;
  const policy = 'test-policy';
  const source = { key: 'project:p1', fingerprint: 'source-a', projectIds: ['p1'], evidence: [], images: [] };
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
      evaluateCandidate: (candidate, history = []) => { mutationHistory = history; return { ...candidate, readiness: candidate.blockers.length ? 'quick' : candidate.readiness }; },
      answerBlocker: (candidate, id, answer) => ({ ...structuredClone(candidate), evidence: [...candidate.evidence, { id, text: answer, source: 'designer_answer' }] }) },
    './evaluator': { evaluateSource: async (s, user, org, history) => { modelHistory = history; evaluations++; if (mutateAfterEvaluate) mutateAfterEvaluate(); return { ...fixture(), sourceVersion: s.fingerprint }; } },
    './store': { CandidateConflictError: Conflict, listStoredCandidates: async () => structuredClone(stored),
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
  console.log('PASS readiness service: read-only browsing, disabled/workspace/ownership guards, stale source/version rejection, attributed edits, image scope, explicit publication, idempotent view keys, budget and provider-race handling.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
