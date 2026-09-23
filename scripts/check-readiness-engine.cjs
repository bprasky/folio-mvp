const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');
const cache = new Map();
function load(file) {
  file = path.resolve(file);
  if (cache.has(file)) return cache.get(file);
  const exports = {}; cache.set(file, exports);
  const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(js, { exports, structuredClone, console, process, Date, require: name => {
    if (name === 'server-only') return {};
    if (name === '@anthropic-ai/sdk' || name === 'sharp') return () => { throw new Error('No live evaluation permitted'); };
    if (name === '@/lib/ai/models') return { MODELS: { sonnet: 'inert' } };
    if (name === '@/lib/interview/prompts/editorialTone') return load('src/lib/interview/prompts/editorialTone.ts');
    if (name === '@/lib/posting/llmClient') return { callLLM: () => { throw new Error('No paid calls'); } };
    if (name === './sources') return { candidateId: (_, __, key) => key, sourceVersion: source => JSON.stringify(source) };
    if (name.startsWith('.')) return load(path.resolve(path.dirname(file), `${name}.ts`));
    return require(name);
  } }, { filename: file });
  return exports;
}
const engine = load('src/lib/publishing-studio/readiness/engine.ts');
const { assembleCandidate, EvaluationSchema } = load('src/lib/publishing-studio/readiness/evaluator.ts');
function fixture(index = 0) {
  const projectId = `p${index}`, text = `Decision${index} choice${index} outcome${index} meaning${index}.`;
  const source = { key: projectId, projectIds: [projectId], title: 'House', origin: 'project', designerName: 'Designer', photographer: 'Photographer',
    evidence: [{ id: 'e', projectId, tier: 'direct', text, source: 'published_prose' }], images: [{ id: `i${index}`, projectId, url: `https://photos/${index}`, approved: true }] };
  const result = { shape: 'decision', thesis: text, headline: `Decision${index} choice${index}`, audienceValue: 'A specific choice', claims: [{ text, evidenceIds: ['e'] }],
    dimensions: { story: 1, evidence: 1, visual: 1, specificity: 1, novelty: 1, designerFit: 1, formatFit: 1 },
    penalties: { semanticOverlap: 0, visualRepetition: 0, genericFraming: 0, commercialDistortion: 0, staleness: 0 },
    images: [{ id: `i${index}`, role: 'hero', reason: 'Shows decision', technical: 1, relevance: 1, aesthetic: 1, crop: 1 }], question: null, contradictions: [] };
  const measures = [{ id: `i${index}`, width: 1400, height: 1400, perceptualHash: '' }];
  return { source, result, measures };
}
function candidate(index = 0) { const f = fixture(index); return assembleCandidate(f.source, 'u', null, EvaluationSchema.parse(f.result), f.measures, []); }
function changed(change) { const c = candidate(); change(c); return engine.evaluateCandidate(c); }
assert.equal(candidate().score, 100);
assert.equal(candidate().readiness, 'ready');
assert.notEqual(candidate().thesis, candidate().draft.headline, 'Public hook is separate from the complete evidence thesis');
for (const [text, headline] of [
  ['We kept the existing cabinetry because the budget went to better windows.', 'We kept the existing cabinetry'],
  ['Open shelves put their ceramic collection within reach.', 'their ceramic collection'],
  ['The island moved so the door could open fully.', 'The island moved'],
  ['We tested three finishes before choosing the matte surface.', 'We tested three finishes'],
  ['The low ceiling determined the lighting choice.', 'The low ceiling'],
]) {
  const short = fixture();
  short.source.evidence[0].text = text;
  short.result.thesis = text;
  short.result.headline = headline;
  short.result.claims[0].text = text;
  const prepared = assembleCandidate(short.source, 'u', null, EvaluationSchema.parse(short.result), short.measures, []);
  assert.equal(prepared.readiness, 'ready');
  assert.equal(prepared.thesis, text);
  assert.equal(prepared.draft.headline, short.result.headline);
  short.result.headline = 'A quieter kitchen for entertaining';
  assert.ok(assembleCandidate(short.source, 'u', null, EvaluationSchema.parse(short.result), short.measures, []).reasons.includes('unsupported_copy'), 'New hooks retain exact grounding');
}
assert.equal(changed(c => c.penalties.semanticOverlap = 20).readiness, 'ready');
assert.equal(changed(c => c.penalties.semanticOverlap = 21).readiness, 'developing');
const quick = changed(c => { c.penalties.semanticOverlap = 25; c.penalties.staleness = 8; c.penalties.genericFraming = 2;
  c.draft.credits.photographer = null; c.blockers = [{ id: 'credit', kind: 'credit', question: 'Who?', evidenceIds: [] }]; });
assert.equal(quick.score, 65); assert.equal(quick.readiness, 'developing');
assert.equal(engine.answerBlocker(quick, 'credit', 'Photographer').readiness, 'developing');
assert.equal(engine.evaluateCandidate({ ...quick, penalties: { ...quick.penalties, genericFraming: 3 } }).readiness, 'developing');
assert.equal(changed(c => { c.penalties.semanticOverlap = 25; c.penalties.visualRepetition = 20; c.penalties.genericFraming = 6; }).readiness, 'suppressed');
assert.equal(changed(c => c.claims[0].text = 'Invented Italian sourcing').readiness, 'suppressed');
assert.equal(changed(c => c.claims[0].evidenceIds.push('invented')).readiness, 'suppressed');
assert.equal(changed(c => c.evidence[0].tier = 'inferred').readiness, 'suppressed');
for (const patch of [{ approved: false }, { width: 800 }, { technical: .4 }, { relevance: .4 }, { aesthetic: .4 }, { crop: .4 }]) {
  assert.equal(changed(c => Object.assign(c.visuals[0], patch)).readiness, 'suppressed');
}
assert.equal(changed(c => c.visuals.push({ ...c.visuals[0] })).readiness, 'suppressed');
assert.equal(changed(c => c.visuals.push({ ...c.visuals[0], id: 'other', url: 'other', technical: .1 })).readiness, 'suppressed');
assert.equal(changed(c => { c.reasons = ['source_contradiction']; }).readiness, 'suppressed');
assert.equal(changed(c => c.draft.caption = 'x'.repeat(2201)).readiness, 'suppressed');
assert.ok(changed(c => c.draft.caption = 'x'.repeat(2180)).reasons.includes('copy_too_long'), 'Credits count toward the exported caption limit');
const f = fixture(); const before = JSON.stringify(f); f.result.images[0].crop = .7; const immutable = JSON.stringify(f);
assembleCandidate(f.source, 'u', null, f.result, f.measures, []); assert.equal(JSON.stringify(f), immutable);
f.result.images = [{ ...f.result.images[0], id: 'unknown' }];
assert.equal(assembleCandidate(f.source, 'u', null, f.result, f.measures, []).readiness, 'suppressed');
const c = candidate(); const snapshot = JSON.stringify(c); engine.evaluateCandidate(c); assert.equal(JSON.stringify(c), snapshot);
const answerable = candidate(); answerable.draft.credits.photographer = null;
answerable.blockers = [{ id: 'credit', kind: 'credit', question: 'Who?', evidenceIds: [] }];
assert.equal(engine.evaluateCandidate(answerable).readiness, 'quick');
const completed = engine.answerBlocker(engine.evaluateCandidate(answerable), 'credit', 'Alex Smith');
assert.equal(completed.readiness, 'ready'); assert.equal(completed.draft.credits.photographer, 'Alex Smith');
assert.equal(completed.blockers[0].answer, 'Alex Smith'); assert.equal(answerable.blockers[0].answer, undefined);
completed.blockers.push({ id: 'context', kind: 'story', question: 'What?', evidenceIds: ['e'] });
const answered = engine.answerBlocker(completed, 'context', 'We made the joinery locally.');
assert.ok(answered.draft.caption.includes('We made the joinery locally.')); assert.equal(answered.blockers[0].answer, 'Alex Smith');
assert.throws(() => engine.answerBlocker(answered, 'unknown', 'no'));
const many = Array.from({ length: 10 }, (_, i) => candidate(i));
many[1].projectIds = many[2].projectIds = many[0].projectIds;
const selected = engine.selectCandidates(many, 100); assert.equal(selected.length, 6);
assert.ok(selected.filter(c => c.projectIds.includes('p0')).length <= 2);
assert.equal(engine.selectCandidates([candidate(), candidate()]).length, 1);
assert.equal(engine.selectCandidates([{ ...candidate(), dismissed: true }]).length, 0);
assert.equal(engine.selectCandidates([{ ...candidate(), confirmedPublishedAt: new Date().toISOString() }]).length, 0);
const longHeadline = fixture(); longHeadline.result.thesis = 'x'.repeat(181);
assert.equal(EvaluationSchema.safeParse(longHeadline.result).success, false);
const oversizedHook = fixture(); oversizedHook.result.headline = 'x'.repeat(101);
assert.equal(EvaluationSchema.safeParse(oversizedHook.result).success, false);
const semantic = fixture(1); semantic.result.duplicateOf = ['p0'];
const semanticallyRepeated = assembleCandidate(semantic.source, 'u', null, EvaluationSchema.parse(semantic.result), semantic.measures, [candidate()]);
assert.equal(semanticallyRepeated.readiness, 'suppressed');
assert.ok(engine.evaluateCandidate(semanticallyRepeated).reasons.includes('semantic_duplicate'));
const dismissedRepeat = assembleCandidate(semantic.source, 'u', null, EvaluationSchema.parse(semantic.result), semantic.measures, [{ ...candidate(), dismissed: true }]);
assert.equal(dismissedRepeat.readiness, 'suppressed', 'A paraphrase of a dismissed idea cannot resurface');
assert.ok(dismissedRepeat.reasons.includes('semantic_duplicate'));
semantic.result.duplicateOf = ['unknown'];
assert.throws(() => assembleCandidate(semantic.source, 'u', null, EvaluationSchema.parse(semantic.result), semantic.measures, [candidate()]));
assert.equal(engine.imageSimilarity({ id: 'a', url: 'a', perceptualHash: '1111111111' }, { id: 'b', url: 'b', perceptualHash: '1111111110' }), .9);
const duplicate = candidate(); duplicate.id = 'new'; duplicate.thesis = 'Alternate framing';
assert.ok(engine.evaluateCandidate(duplicate, [candidate()]).reasons.includes('duplicate_story'));
assert.ok(engine.evaluateCandidate(duplicate, [{ ...candidate(), dismissed: true, readiness: 'suppressed' }]).reasons.includes('duplicate_story'), 'Dismissed history also blocks duplicates without a model judgment');
console.log('PASS readiness engine: score bands, exact grounding, visual gates, duplicate diversity, answers, immutable inputs, unknown images, persistent contradictions');
