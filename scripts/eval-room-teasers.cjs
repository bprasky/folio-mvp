/** Live provider smoke; synthetic inputs only, no database access. Run: node scripts/eval-room-teasers.cjs */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const dotenv = require('dotenv');
const root = path.resolve(__dirname, '..');
for (const file of ['.env.local', '.env']) {
  const filename = path.join(root, file);
  if (!fs.existsSync(filename)) continue;
  const parsed = dotenv.parse(fs.readFileSync(filename));
  for (const key of ['ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN', 'ANTHROPIC_BASE_URL']) {
    if (!process.env[key] && parsed[key]) process.env[key] = parsed[key];
  }
}

const events = [], incidents = [], requests = [];
const cache = new Map();
const SDK = require('@anthropic-ai/sdk');
const Anthropic = SDK.default || SDK;
class LiveAnthropic extends Anthropic {
  constructor(options = {}) {
    super({ ...options, maxRetries: 0, timeout: 60000, fetch: async (...args) => {
      if (requests.length >= 24) throw new Error('Smoke request limit reached');
      const entry = { status: null };
      requests.push(entry);
      try {
        const response = await fetch(...args);
        entry.status = response.status;
        if (!response.ok) {
          const body = await response.clone().json().catch(() => ({}));
          entry.errorType = body.error?.type || 'provider_error';
          entry.message = String(body.error?.message || 'Provider rejected request').replace(/sk-[\w-]+/g, '[redacted]');
        }
        return response;
      } catch (error) {
        entry.errorType = error.cause?.code || error.name || 'network_error';
        throw error;
      }
    } });
  }
}

// Only cost-event persistence is replaced. Any other Prisma access fails immediately.
const blockedPrisma = new Proxy({}, { get(_target, key) {
  if (key === 'costEvent') return { create: async ({ data }) => { events.push(data); return data; } };
  throw new Error(`Database access prohibited in synthetic smoke: ${String(key)}`);
} });
function load(filename) {
  filename = path.resolve(filename);
  if (cache.has(filename)) return cache.get(filename).exports;
  const loadedModule = { exports: {} };
  cache.set(filename, loadedModule);
  const localRequire = (id) => {
    if (id === '@anthropic-ai/sdk') return { __esModule: true, default: LiveAnthropic };
    if (id === '@/lib/prisma') return { prisma: blockedPrisma };
    if (id === '@/lib/ai/errors') return { reportAiIncident: async (event) => incidents.push(event) };
    if (id.startsWith('@/') || id.startsWith('.')) {
      const resolved = id.startsWith('@/') ? path.join(root, 'src', id.slice(2)) : path.resolve(path.dirname(filename), id);
      return load(resolved.endsWith('.ts') ? resolved : `${resolved}.ts`);
    }
    if (id.includes('prisma')) throw new Error('Prisma package access prohibited');
    return require(id);
  };
  const sourceText = filename.endsWith('generateFolioLines.baseline.ts') ? require('node:child_process').execFileSync('git', ['show', 'd83851e46cb3a1f75f4e02c4189bcda35cb13a6b:src/lib/posting/generateFolioLines.ts'], { cwd: root, encoding: 'utf8' }) : fs.readFileSync(filename, 'utf8');
  const compiled = ts.transpileModule(sourceText, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  vm.runInThisContext(`(function(require,module,exports){${compiled}\n})`, { filename })(localRequire, loadedModule, loadedModule.exports);
  return loadedModule.exports;
}

const fixtures = [
  { name: 'First-person circulation choice', room: 'Living Room',
    quote: 'We moved the sofa away from the door because we wanted to leave a clear path into the living room.',
    answer: 'We moved the sofa away from the door because we wanted to leave a clear path into the living room. The first arrangement made people walk around its back before they could sit down. We tried both positions before settling on this one.', tags: [{ name: 'Sofa', category: 'Sofa' }] },
  { name: 'Dining room with several supported angles', room: 'Dining Room',
    quote: 'We chose glass for the dining table because a solid wood top would have looked too heavy in this small room.',
    answer: 'We chose glass for the dining table because a solid wood top would have looked too heavy in this small room. We wanted to see the floor through the table. It was a visual decision; the table takes up the same amount of floor space. Black accents on the pendants, chairs and door hardware balance this bright room. Round pendant lights repeat a shape used across the house. This room is a cross section of the project.',
    article: ['A glass table keeps sightlines open in the dining room. Black accents balance the brightness, and round pendants carry a recurring shape into this room.'],
    tags: [{ name: 'Dining table', category: 'Table', material: 'glass' }, { name: 'Considered table top', category: 'Table', material: 'solid wood' }, { name: 'Pendant lights', finish: 'black', shape: 'round' }, { name: 'Chairs', finish: 'black' }, { name: 'Door hardware', finish: 'black' }] },
  { name: 'Thin preference without supporting intent', room: 'Bedroom',
    quote: 'I liked this arrangement when we tried it, but I cannot really explain why I preferred it.',
    answer: 'I liked this arrangement when we tried it, but I cannot really explain why I preferred it. That is all I remember about this room.', tags: [] },
];

async function main() {
  const generators = { before: load(path.join(root, 'src/lib/posting/generateFolioLines.baseline.ts')).generateFolioLines, after: load(path.join(root, 'src/lib/posting/generateFolioLines.ts')).generateFolioLines };
  const { MODEL_FOR } = load(path.join(root, 'src/lib/ai/models.ts'));
  const rows = [];
  const started = new Date().toISOString();
  for (const [mode, generateFolioLines] of Object.entries(generators)) for (const [i, fixture] of fixtures.entries()) {
    const before = events.length, requestBefore = requests.length, start = Date.now();
    const questionId = `synthetic-room-${i + 1}`;
    const answer = { questionId, questionText: 'What informed this choice?', answer: fixture.answer,
      section: fixture.room, category: null, isFollowUp: false };
    const direct = { text: fixture.quote, score: 10, provenance: { questionId, isFollowUp: false } };
    let output = [], error = null;
    try {
      output = await generateFolioLines(fixture.room, [answer], `smoke-${i + 1}`, { selected: direct, alternatives: [direct] }, fixture.tags, fixture.article || []);
    } catch (e) { error = e.message; }
    rows.push({ fixture: `${mode}: ${fixture.name}`, source: fixture.answer, directQuote: fixture.quote, output,
      elapsedMs: Date.now() - start, costs: events.slice(before), requests: requests.slice(requestBefore), error });
    // Provider errors do not justify spending more calls on other fixtures.
    if (error) break;
  }
  const totalIn = events.reduce((n, e) => n + (e.inputTokens || 0), 0);
  const totalOut = events.reduce((n, e) => n + (e.outputTokens || 0), 0);
  const totalCost = events.reduce((n, e) => n + e.costUsdEstimate, 0);
  const lines = ['# Written by Folio: live synthetic smoke', '', `Run: ${started}`, `Model: ${MODEL_FOR.prose}`, '',
    'Calls execute the production generateFolioLines and callLLM code against the configured provider. SDK retries are disabled and requests capped at twenty-four. Only synthetic interviews are sent. Cost-event persistence is captured locally; other database operations are blocked. AI incident persistence is captured locally. Existing repository rates estimate cost.', '',
    '| Fixture | Requests | Tokens in/out | Estimated USD | Elapsed | Result |', '|---|---:|---:|---:|---:|---|'];
  for (const row of rows) lines.push(`| ${row.fixture} | ${row.requests.length} | ${row.costs.reduce((n,e)=>n+(e.inputTokens||0),0)}/${row.costs.reduce((n,e)=>n+(e.outputTokens||0),0)} | $${row.costs.reduce((n,e)=>n+e.costUsdEstimate,0).toFixed(6)} | ${(row.elapsedMs/1000).toFixed(1)}s | ${row.error || `${row.output.length} approved options`} |`);
  lines.push('', `Total usage reported: ${totalIn} input / ${totalOut} output tokens; estimated $${totalCost.toFixed(6)}.`, 'Before is the narrow quote rewrite; after is the grounded room teaser.', 'Unreturned usage on failed requests is unknown, not measured as zero billed usage.', '');
  for (const row of rows) {
    lines.push(`## ${row.fixture}`, '', `Original: ${row.directQuote}`, '', `Context: ${row.source}`, '');
    row.output.forEach((line, i) => lines.push(`${i + 1}. ${line.text}`));
    if (!row.output.length) lines.push('No approved output returned.');
    if (row.error) lines.push('', `Failure: ${row.error}`, '', 'Provider diagnostics:', '```json', JSON.stringify(row.requests, null, 2), '```');
    lines.push('');
  }
  lines.push('## Review', '', rows.some(r => r.error) ? 'Live quality evaluation blocked by provider/request failure. No model substitution was attempted. Remaining fixtures were not sent.' : 'Human meaning/voice assessment pending review of the actual outputs above.', '');
  fs.mkdirSync(path.join(root, 'docs/reviews'), { recursive: true });
  fs.writeFileSync(path.join(root, 'docs/reviews/ROOM_TEASERS_EVAL.md'), lines.join('\n'));
  console.log(JSON.stringify({ model: MODEL_FOR.prose, requests: requests.length, rows, totalIn, totalOut, totalCost }, null, 2));
  if (rows.some(r => r.error)) process.exitCode = 1;
}
main().catch(error => { console.error('Smoke setup failed:', error.message); process.exitCode = 1; });



