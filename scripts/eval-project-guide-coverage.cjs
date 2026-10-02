// Diagnostic only: three actual Sonnet coverage extractions, no application writes.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const ts = require('typescript');
const { zodOutputFormat } = require('@anthropic-ai/sdk/helpers/zod');
if (!process.argv.includes('--live')) {
  console.log('Use --live to run three synthetic coverage-only extraction cases.');
  process.exit(0);
}
require('dotenv').config({ path: '.env.local', quiet: true });
require('dotenv').config({ path: '.env', quiet: true });
const Anthropic = require('@anthropic-ai/sdk').default;
const modelExports = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/ai/models.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, { exports: modelExports });
const fixtures = require('./fixtures/project-guide-coverage-quality.json');
if (fixtures.length !== 3) throw Error('This diagnostic is bounded to three calls.');
const destination = 'docs/reviews/project-guide/coverage-extraction-evaluation.json';
function loadCoverageModule(file) {
  file = path.resolve(file); const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports, Error, require(name) {
    // The fixture already supplies the raw context; loading the controller or
    // any service would add no information and risks unrelated dependencies.
    if (name === './controller') return {};
    if (name.startsWith('.')) return loadCoverageModule(path.resolve(path.dirname(file), name) + '.ts');
    return require(name);
  } }, { filename: file });
  return exports;
}
const coverage = loadCoverageModule('src/lib/interview/guided/coverage.ts');
const { podcastCoverageSchema } = loadCoverageModule('src/lib/interview/guided/coverage.schemas.ts');
const SYSTEM = coverage.PODCAST_COVERAGE_PROMPT;
async function main() {
  const result = { capturedAt: new Date().toISOString(), status: 'running',
    boundary: 'Diagnostic only: three actual Sonnet extraction calls using synthetic raw accepted answer/correction texts, IDs, room IDs and pending targets. No proposed question, purpose, original collection category/question, database, Tavus, production write or persistent coverage ledger.',
    model: modelExports.MODEL_FOR.interview, thinking: 'disabled', maxTokens: 700, system: SYSTEM, cases: [] };
  if (fs.existsSync(destination)) {
    const prior = JSON.parse(fs.readFileSync(destination, 'utf8'));
    result.previousAttempts = [...(prior.previousAttempts || []), { ...prior, previousAttempts: undefined }];
  }
  const client = new Anthropic({ timeout: 20000, maxRetries: 0 });
  for (const fixture of fixtures) {
    const { acceptedAnswers, pendingTargets } = fixture.input;
    const schema = podcastCoverageSchema(pendingTargets.map(target => target.id), acceptedAnswers.map(answer => answer.id));
    const started = Date.now(); let call;
    try {
      const response = await client.messages.create({ model: modelExports.MODEL_FOR.interview,
        thinking: { type: 'disabled' }, max_tokens: 700, output_config: { format: zodOutputFormat(schema) },
        system: SYSTEM, messages: [{ role: 'user', content: JSON.stringify(fixture.input) }] });
      const raw = response.content.filter(item => item.type === 'text').map(item => item.text).join('');
      call = { model: response.model, inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens,
        milliseconds: Date.now() - started, output: raw, stopReason: response.stop_reason };
      if (response.stop_reason === 'max_tokens') throw Error('Coverage response truncated.');
      const parsed = { covered: coverage.validatePodcastCoverage(JSON.parse(raw), fixture.input) };
      const ids = new Set(parsed.covered.map(item => item.questionId));
      const passed = fixture.expectedCovered.every(id => ids.has(id)) && fixture.expectedAbsent.every(id => !ids.has(id));
      result.cases.push({ ...fixture, parsed, passed, call });
      console.log(fixture.id, JSON.stringify({ passed, covered: parsed.covered }));
    } catch (error) {
      result.cases.push({ ...fixture, passed: false, error: error.message, call });
      console.log(fixture.id, error.message);
    }
  }
  const calls = result.cases.flatMap(item => item.call ? [item.call] : []);
  const inputTokens = calls.reduce((sum, call) => sum + call.inputTokens, 0);
  const outputTokens = calls.reduce((sum, call) => sum + call.outputTokens, 0);
  result.metrics = { calls: calls.length, inputTokens, outputTokens,
    estimatedCostUsd: (inputTokens * 3 + outputTokens * 15) / 1e6,
    milliseconds: calls.reduce((sum, call) => sum + call.milliseconds, 0),
    pricingBasis: 'Repository Sonnet estimate: USD3/15 per million input/output tokens.' };
  result.status = result.cases.every(item => item.passed) ? 'passed' : 'failed';
  result.sourceHashes = Object.fromEntries(['src/lib/interview/guided/coverage.ts', 'src/lib/interview/guided/coverage.schemas.ts',
    'scripts/eval-project-guide-coverage.cjs', 'scripts/fixtures/project-guide-coverage-quality.json'].map(file =>
    [file, crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')]));
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, JSON.stringify(result, null, 2) + '\n');
  if (result.status !== 'passed') process.exitCode = 1;
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
