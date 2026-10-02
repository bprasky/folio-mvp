// Bounded synthetic review calibrations; actual model, no database/Tavus calls.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const ts = require('typescript');
if (!process.argv.includes('--live')) {
  console.log('Use --live for the five auditor cases, or --live --constraint-repair for eight preserved joint-audit cases.');
  process.exit(0);
}
require('dotenv').config({ path: '.env.local', quiet: true });
require('dotenv').config({ path: '.env', quiet: true });
const Anthropic = require('@anthropic-ai/sdk').default;
const fixtureFile = process.argv.includes('--constraint-repair')
  ? 'scripts/fixtures/podcast-premise-repair-quality.json' : 'scripts/fixtures/podcast-review-quality.json';
const fixtures = require(path.resolve(fixtureFile));
const destination = process.argv.includes('--constraint-repair')
  ? 'docs/reviews/project-guide/constraint-repair-evaluation.json' : 'docs/reviews/project-guide/auditor-evaluation.json';
let calls = [], totalCalls = 0;
class RecordedAnthropic {
  constructor(options) {
    const client = new Anthropic(options);
    this.messages = { create: async request => {
      const ordinal = ++totalCalls;
      if (ordinal > fixtures.length * 2) throw Error('Synthetic joint-review call budget exceeded.');
      const started = Date.now(); const response = await client.messages.create(request);
      calls.push({ ordinal, operation: JSON.parse(request.messages[0].content).citedPassages ? 'factual-review' : 'conversation-review',
        thinking: request.thinking, effort: request.output_config?.effort ?? null, maxTokens: request.max_tokens,
        startedAt: new Date(started).toISOString(), model: response.model, inputTokens: response.usage.input_tokens,
        usage: response.usage, estimatedCostUsd: load('src/lib/ai/cost.ts').anthropicCostUsd(response.model, response.usage),
        outputTokens: response.usage.output_tokens, milliseconds: Date.now() - started,
        input: JSON.parse(request.messages[0].content),
        output: response.content.filter(item => item.type === 'text').map(item => item.text).join('') });
      return response;
    } };
  }
}
const cache = new Map();
function load(file) {
  file = path.resolve(file); if (cache.has(file)) return cache.get(file);
  const exports = {}; cache.set(file, exports);
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
  } }).outputText;
  vm.runInNewContext(code, { exports, process, console, Error, structuredClone, setTimeout, clearTimeout, require(name) {
    if (name === '@anthropic-ai/sdk') return { default: RecordedAnthropic, __esModule: true };
    if (name === '@/lib/prisma') return { prisma: new Proxy({}, { get() { throw Error('Database forbidden in review evaluation'); } }) };
    if (name === '@/lib/ai/cost') return { recordCostEvent: async () => {}, anthropicCostUsd: () => 0 };
    if (name === 'server-only') return {};
    if (name.startsWith('@/')) return load(path.resolve('src', name.slice(2)) + '.ts');
    if (name.startsWith('.')) return load(path.resolve(path.dirname(file), name) + '.ts');
    return require(name);
  } }, { filename: file }); return exports;
}
async function main() {
  const result = { capturedAt: new Date().toISOString(), status: 'running',
    boundary: `${fixtures.length} actual joint podcast-review cases, at most ${fixtures.length * 2} calls in parallel pairs, over synthetic preserved flawed and valid candidates. No generation, database, Tavus, device capture or real designer content. No raw thinking stored.`, cases: [] };
  if (fs.existsSync(destination)) {
    const prior = JSON.parse(fs.readFileSync(destination, 'utf8'));
    result.previousAttempts = [...(prior.previousAttempts || []), { ...prior, previousAttempts: undefined }];
  }
  const decision = load('src/lib/interview/guided/decision.ts');
  const factualSchema = load('src/lib/interview/guided/factual-review.schemas.ts').PodcastFactualReviewSchema;
  for (const fixture of fixtures) {
    calls = []; const started = Date.now();
    try {
      const review = await decision.reviewGuidedContent(fixture.candidate, fixture.context, 'synthetic-review-only');
      const factCall = calls.find(call => call.operation === 'factual-review');
      const factualReview = factualSchema.parse(JSON.parse(factCall.output));
      const expectedFactualValid = fixture.id === 'invalid-broad-reset' ? true : fixture.expectedValid;
      const passed = review.valid === fixture.expectedValid && factualReview.valid === expectedFactualValid;
      result.cases.push({ ...fixture, review, factualReview, expectedFactualValid, passed, milliseconds: Date.now() - started, calls });
      console.log(fixture.id, JSON.stringify({ passed, review }));
    } catch (error) {
      result.cases.push({ ...fixture, passed: false, error: error.message, milliseconds: Date.now() - started, calls });
      console.log(fixture.id, error.message);
    }
  }
  result.status = result.cases.every(item => item.passed) ? 'passed' : 'failed';
  const allCalls = result.cases.flatMap(item => item.calls);
  const inputTokens = allCalls.reduce((sum, call) => sum + call.inputTokens, 0);
  const outputTokens = allCalls.reduce((sum, call) => sum + call.outputTokens, 0);
  result.metrics = { calls: allCalls.length, inputTokens, outputTokens,
    estimatedCostUsd: allCalls.reduce((sum, call) => sum + call.estimatedCostUsd, 0),
    fixtureWallMilliseconds: result.cases.reduce((sum, item) => sum + item.milliseconds, 0),
    summedProviderMilliseconds: allCalls.reduce((sum, call) => sum + call.milliseconds, 0) };
  result.sourceHashes = Object.fromEntries(['src/lib/interview/guided/decision.ts', 'src/lib/interview/guided/decision.schemas.ts',
    'src/lib/interview/guided/factual-review.ts', 'src/lib/interview/guided/factual-review.schemas.ts',
    'src/lib/ai/models.ts', 'src/lib/ai/cost.ts',
    'scripts/eval-project-guide-review.cjs', fixtureFile].map(file =>
    [file, crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')]));
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, JSON.stringify(result, null, 2) + '\n');
  if (result.status !== 'passed') process.exitCode = 1;
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
