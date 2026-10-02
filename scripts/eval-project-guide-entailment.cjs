// Bounded factual-only comparison. No production module edits or application writes.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const ts = require('typescript');
const { zodOutputFormat } = require('@anthropic-ai/sdk/helpers/zod');
if (!process.argv.includes('--live')) {
  console.log('Use --live --adaptive-low or --adaptive-medium for eight synthetic cases; --live alone retains the disabled seven-case comparator.');
  process.exit(0);
}
require('dotenv').config({ path: '.env.local', quiet: true });
require('dotenv').config({ path: '.env', quiet: true });
const Anthropic = require('@anthropic-ai/sdk').default;
const modelExports = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/ai/models.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, { exports: modelExports });
const fixtureFile = 'scripts/fixtures/podcast-premise-repair-quality.json';
const effort = process.argv.includes('--adaptive-medium') ? 'medium' : process.argv.includes('--adaptive-low') ? 'low' : null;
const adaptive = effort !== null;
const fixtures = require(path.resolve(fixtureFile)).filter(item => adaptive || item.id !== 'invalid-broad-reset');
if (fixtures.length !== (adaptive ? 8 : 7)) throw Error('Factual-only fixture count exceeds the authorized call budget.');
const destination = adaptive ? 'docs/reviews/project-guide/factual-reasoning-evaluation.json'
  : 'docs/reviews/project-guide/factual-entailment-evaluation.json';
function loadModule(file) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, { exports, require }, { filename: file });
  return exports;
}
const SYSTEM = loadModule('src/lib/interview/guided/factual-review.ts').PODCAST_FACTUAL_REVIEW_PROMPT;
const schema = loadModule('src/lib/interview/guided/factual-review.schemas.ts').PodcastFactualReviewSchema;
async function main() {
  const started = Date.now();
  const result = { capturedAt: new Date(started).toISOString(), status: 'running',
    boundary: `${fixtures.length} actual configured Sonnet calls using production factual prompt/schema with only synthetic spoken question text, exact cited passages and authoritative room names. No candidate kind, target, collection labels, plan, coverage, full history, database or Tavus calls. No production configuration changes or raw thinking stored.`,
    model: modelExports.MODEL_FOR.interview, thinking: adaptive ? 'adaptive' : 'disabled',
    effort, maxTokens: effort === 'medium' ? 2400 : adaptive ? 1600 : 180, system: SYSTEM, cases: [] };
  if (fs.existsSync(destination)) {
    const prior = JSON.parse(fs.readFileSync(destination, 'utf8'));
    result.previousAttempts = [...(prior.previousAttempts || []), { ...prior, previousAttempts: undefined }];
  }
  const client = new Anthropic({ timeout: 20000, maxRetries: 0 });
  for (const fixture of fixtures) {
    const expectedValid = fixture.id === 'invalid-broad-reset' ? true : fixture.expectedValid;
    const input = { question: fixture.candidate.text, citedPassages: fixture.candidate.evidence.map(value => value.quote),
      knownRoomNames: (fixture.context.rooms || []).map(room => room.name) };
    const callStarted = Date.now(); let call;
    try {
      const response = await client.messages.create({ model: modelExports.MODEL_FOR.interview,
        thinking: { type: adaptive ? 'adaptive' : 'disabled' }, max_tokens: result.maxTokens,
        output_config: { format: zodOutputFormat(schema), ...(adaptive ? { effort } : {}) },
        system: SYSTEM, messages: [{ role: 'user', content: JSON.stringify(input) }] });
      const output = response.content.filter(block => block.type === 'text').map(block => block.text).join('');
      call = { model: response.model, inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens,
        milliseconds: Date.now() - callStarted, output, stopReason: response.stop_reason };
      if (response.stop_reason === 'max_tokens') throw Error('Factual verdict was truncated.');
      const review = schema.parse(JSON.parse(output));
      const passed = review.valid === expectedValid;
      result.cases.push({ id: fixture.id, expectedValid, expected: fixture.expected,
        sourceArtifact: fixture.sourceArtifact, sourceCapturedAt: fixture.sourceCapturedAt,
        sourceCallIndex: fixture.sourceCallIndex, input, review, passed, call });
      console.log(fixture.id, JSON.stringify({ passed, review }));
    } catch (error) {
      result.cases.push({ id: fixture.id, expectedValid, input, passed: false, error: error.message, call });
      console.log(fixture.id, error.message);
    }
  }
  const calls = result.cases.flatMap(item => item.call ? [item.call] : []);
  const inputTokens = calls.reduce((sum, call) => sum + call.inputTokens, 0);
  const outputTokens = calls.reduce((sum, call) => sum + call.outputTokens, 0);
  result.metrics = { calls: calls.length, inputTokens, outputTokens,
    estimatedCostUsd: (inputTokens * 3 + outputTokens * 15) / 1e6,
    wallMilliseconds: Date.now() - started, summedProviderMilliseconds: calls.reduce((sum, call) => sum + call.milliseconds, 0) };
  result.status = result.cases.every(item => item.passed) ? 'passed' : 'failed';
  result.sourceHashes = Object.fromEntries(['src/lib/interview/guided/factual-review.ts', 'src/lib/interview/guided/factual-review.schemas.ts',
    'scripts/eval-project-guide-entailment.cjs', fixtureFile].map(file =>
    [file, crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')]));
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, JSON.stringify(result, null, 2) + '\n');
  if (result.status !== 'passed') process.exitCode = 1;
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
