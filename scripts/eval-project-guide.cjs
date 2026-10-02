// Synthetic, bounded provider eval. No database or Tavus calls; outputs contain fixture text only.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const ts = require('typescript');
const assert = require('node:assert/strict');
if (!process.argv.includes('--live')) { console.log('Use --live --before or --live --after; synthetic Anthropic inputs only.'); process.exit(0); }
require('dotenv').config({ path: '.env.local', quiet: true });
require('dotenv').config({ path: '.env', quiet: true });
const Anthropic = require('@anthropic-ai/sdk').default;
const side = process.argv.includes('--before') ? 'before' : 'after';
let calls = [], requestsStarted = 0;
class RecordedAnthropic {
  constructor(options) { const client = new Anthropic(options); this.messages = { create: async request => {
    const ordinal = ++requestsStarted;
    if (ordinal > (side === 'before' ? 4 : 7)) throw Error('Per-fixture provider call budget exceeded.');
    const start = Date.now(); const response = await client.messages.create(request);
    calls.push({ model: response.model, inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens,
      usage: response.usage, estimatedCostUsd: load('src/lib/ai/cost.ts').anthropicCostUsd(response.model, response.usage),
      ordinal, startedAt: new Date(start).toISOString(), milliseconds: Date.now() - start,
      thinking: request.thinking, effort: request.output_config?.effort ?? null, maxTokens: request.max_tokens,
      operation: JSON.parse(request.messages[0].content).citedPassages ? 'factual-review' : request.output_config?.format?.schema?.properties?.covered ? 'coverage' : request.output_config?.format?.schema?.properties?.valid ? 'review' : 'proposal',
      input: JSON.parse(request.messages[0].content), output: response.content.filter(c => c.type === 'text').map(c => c.text).join('') });
    return response;
  } }; }
}
const cache = new Map();
function load(file) {
  file = path.resolve(file); if (cache.has(file)) return cache.get(file);
  const exports = {}; cache.set(file, exports);
  const source = file.endsWith(path.join('guided', 'decision.ts')) && side === 'before'
    ? execFileSync('git', ['show', 'c3f3285e6b866e0d1d5eaf7b2bda425519517863:src/lib/interview/guided/decision.ts'], { encoding: 'utf8' })
    : fs.readFileSync(file, 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  vm.runInNewContext(code, { exports, process, console, Error, structuredClone, setTimeout, clearTimeout, require(name) {
    if (name === '@anthropic-ai/sdk') return { default: RecordedAnthropic, __esModule: true };
    if (name === '@/lib/prisma') return { prisma: new Proxy({}, { get() { throw Error('DB forbidden in prompt eval'); } }) };
    if (name === '@/lib/ai/cost') return { recordCostEvent: async () => {}, anthropicCostUsd: () => 0 };
    if (name === 'server-only') return {};
    if (name.startsWith('@/')) return load(path.resolve('src', name.slice(2)) + '.ts');
    if (name.startsWith('.')) return load(path.resolve(path.dirname(file), name) + '.ts');
    return require(name);
  } }, { filename: file }); return exports;
}
function checkPodcast(fixture, proposal, controller) {
  const { id } = fixture;
  const reply = [proposal.reaction, proposal.text].filter(Boolean).join(' ');
  if (id === 'unexpected-discovery') {
    assert.equal(proposal.kind, 'followup', 'Explore the volunteered turn in the story before checklist scope.');
    assert.match(reply, /courtyard|discover|brief|changed|hidden|sealed/i);
  }
  if (id === 'tangent-resolves') assert.ok(['ask_prepared', 'confirm_coverage'].includes(proposal.kind), 'Return to the backbone after the designer closes the tangent.');
  if (id === 'concise-rich-answer') {
    assert.ok(['confirm_coverage', 'ask_prepared'].includes(proposal.kind), 'A complete answer returns to coverage or a genuinely unanswered obligation, not a manufactured tangent.');
    if (proposal.kind === 'ask_prepared') {
      assert.notEqual(proposal.questionId, 'DESIGN_DIRECTION', 'The known design direction cannot be asked again as new information.');
      const next = structuredClone(fixture.session); controller.applyDecision(next, proposal);
      assert.equal(next.plan.find(question => question.id === 'DESIGN_DIRECTION').status, 'pending', 'Choosing a new topic preserves the covered obligation for later explicit confirmation.');
    }
  }
  if (id === 'room-progression') { assert.equal(proposal.kind, 'ask_prepared'); assert.match(proposal.questionId, /^kitchen-/); }
  if (id === 'correction') assert.doesNotMatch(reply, /holiday|never moved|no relocation/i);
}
async function main() {
  const destination = '.tmp/project-guide-eval/results.json';
  const previous = fs.existsSync(destination) ? JSON.parse(fs.readFileSync(destination, 'utf8')) : {};
  const result = { capturedAt: new Date().toISOString(), podcast: [], guide: [],
    sourceHashes: Object.fromEntries(['src/lib/interview/guided/decision.ts', 'src/lib/interview/guided/decision.schemas.ts',
      'src/lib/interview/guided/coverage.ts', 'src/lib/interview/guided/coverage.schemas.ts',
      'src/lib/interview/guided/factual-review.ts', 'src/lib/interview/guided/factual-review.schemas.ts',
      'src/lib/ai/models.ts', 'src/lib/ai/cost.ts',
      'src/lib/interview/guided/controller.ts', 'scripts/eval-project-guide.cjs',
      'scripts/fixtures/podcast-interview-quality.cjs'].map(file => [file,
      crypto.createHash('sha256').update(side === 'before' && file.endsWith('/decision.ts')
        ? execFileSync('git', ['show', `c3f3285e6b866e0d1d5eaf7b2bda425519517863:${file}`])
        : fs.readFileSync(file)).digest('hex')])) };
  const decision = load('src/lib/interview/guided/decision.ts');
  const controller = load('src/lib/interview/guided/controller.ts');
  const selectedFixtures = process.argv.find(arg => arg.startsWith('--fixtures='))?.slice('--fixtures='.length).split(',');
  if (selectedFixtures && previous[side]) {
    result.podcast = previous[side].podcast.filter(f => !selectedFixtures.includes(f.id));
    result.guide = previous[side].guide;
  }
  for (const fixture of require('./fixtures/podcast-interview-quality.cjs').filter(fixture => !process.argv.includes('--guide-only') && (!selectedFixtures || selectedFixtures.includes(fixture.id)))) {
    calls = []; requestsStarted = 0; const start = Date.now();
    try {
      const proposal = await decision.proposeGuidedNext(fixture.session, fixture.parent, fixture.turn);
      if (side === 'after') checkPodcast(fixture, proposal, controller);
      result.podcast.push({ id: fixture.id, expected: fixture.expected, proposal, calls, milliseconds: Date.now() - start });
    } catch (e) { result.podcast.push({ id: fixture.id, error: e.message, calls, milliseconds: Date.now() - start }); if (side === 'after') process.exitCode = 1; }
    console.log(side, fixture.id, JSON.stringify(result.podcast.at(-1)));
    fs.writeFileSync(destination, JSON.stringify({ ...previous, [side]: result }, null, 2));
  }
  if (process.argv.includes('--guide-only')) result.podcast = previous[side]?.podcast ?? [];
  if (side === 'after' && !selectedFixtures) {
    const planner = load('src/lib/live-interview/project-guide-planner.ts');
    for (const fixture of require('./fixtures/project-guide-quality.cjs')) {
      calls = []; requestsStarted = 0; const start = Date.now();
      try {
        const reply = await planner.planProjectGuide(fixture.input);
        assert.equal(reply.action, fixture.expectedAction); assert.equal(calls.length, fixture.id === 'ambiguous-resume' ? 0 : 1);
        if (fixture.id === 'tagging-counts') { assert.match(reply.reply, /5|five/i); assert.match(reply.reply, /12|twelve/i); }
        if (fixture.id === 'upload-before-project') assert.doesNotMatch(reply.reply, /(?:already|have|I've|I have) (?:uploaded|imported)/i);
        if (fixture.id === 'completed-add-detail') { assert.ok(reply.detailText); assert.ok(fixture.input.userText.includes(reply.detailText)); }
        result.guide.push({ id: fixture.id, reply, calls, milliseconds: Date.now() - start });
      } catch (e) { result.guide.push({ id: fixture.id, error: e.message, calls }); process.exitCode = 1; }
      console.log(side, fixture.id, JSON.stringify(result.guide.at(-1)));
      fs.writeFileSync(destination, JSON.stringify({ ...previous, [side]: result }, null, 2));
    }
  }
}
main().catch(e => { console.error(e.message); process.exitCode = 1; });
