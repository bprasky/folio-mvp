// Runs production decision code with synthetic sessions; DB and cost writes throw/no-op.
// --live --before captures the existing implementation before prompt edits.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { createHash } = require('node:crypto');
const assert = require('node:assert/strict');
const fixtures = require('./fixtures/guided-conversation-quality.cjs');
if (!process.argv.includes('--live')) { console.log('Use --live --before or --live --after. Synthetic Anthropic calls only; no database access.'); process.exit(0); }
require('dotenv').config({ path: '.env.local', quiet: true });
require('dotenv').config({ path: '.env', quiet: true });
const Anthropic = require('@anthropic-ai/sdk').default;
let calls = [];
class RecordingAnthropic {
  constructor(options) { const client = new Anthropic(options); this.messages = { create: async request => {
    const start = Date.now(); const response = await client.messages.create(request);
    calls.push({ inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens, model: response.model, milliseconds: Date.now() - start, output: response.content.filter(block => block.type === 'text').map(block => block.text).join('') });
    return response;
  } }; }
}
const cache = new Map();
function load(file) {
  file = path.resolve(file); if (cache.has(file)) return cache.get(file);
  const exports = {}; cache.set(file, exports);
  const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  vm.runInNewContext(js, { exports, process, console, Error, structuredClone, setTimeout, clearTimeout, require(name) {
    if (name === '@anthropic-ai/sdk') return { default: RecordingAnthropic, __esModule: true };
    if (name === '@/lib/prisma') return { prisma: new Proxy({}, { get() { throw Error('No database access permitted in synthetic eval'); } }) };
    if (name === '@/lib/ai/cost') return { recordCostEvent: async () => {}, anthropicCostUsd: (_, usage) => (usage.input_tokens * 3 + usage.output_tokens * 15) / 1e6 };
    if (name === 'server-only') return {};
    if (name.startsWith('@/')) return load(path.resolve('src', name.slice(2)) + '.ts');
    if (name.startsWith('.')) return load(path.resolve(path.dirname(file), name) + '.ts');
    return require(name);
  } }, { filename: file }); return exports;
}
function checkQuality(id, proposal) {
  const reply = [proposal.reaction, proposal.text].filter(Boolean).join(' ');
  if (id === 'friends-new-york-miami' || id.startsWith('sequential')) {
    assert.doesNotMatch(reply, /opening up (?:everything|the interiors|the interior)|open.plan/i, 'Redesigning every space does not establish opening up a floor plan.');
    if (proposal.kind !== 'confirm_coverage') assert.doesNotMatch(proposal.text || '', /what (?:was|is|became).*overall design (?:idea|concept)|what.*(?:central|overall|guiding) (?:design )?concept/i, 'Plain-language quiet exterior/personal interior already establishes direction; ask the missing realization or confirm it.');
    if (proposal.kind === 'ask_prepared' && proposal.questionId === 'SCOPE_PARAMETERS') {
      const broadReset = /working within|what were (?:the |your |the actual |the practical )?(?:parameters|boundaries|constraints)/i.test(proposal.text);
      const namedParameter = /budget|timeline|schedule|deadline|structur(?:e|al)|preservation|permit|permission/i.test(proposal.text);
      assert.ok(!broadReset || namedParameter, 'Known scope needs a named remaining parameter rather than a generic scope reset.');
    }
  }
  if (id === 'concise-rich-answer') assert.equal(proposal.kind, 'confirm_coverage', 'A stated design idea needs confirmation, not another request for an idea.');
  if (id === 'room-progression') { assert.equal(proposal.kind, 'ask_prepared'); assert.match(proposal.questionId, /^kitchen-/); assert.equal(proposal.sourceAnswerIds.length, 0); assert.equal(proposal.reaction, undefined, 'No uncited Living Room facts in the next-room transition.'); }
  if (id === 'unselected-product') assert.doesNotMatch(proposal.text || '', /lamp|vintage|red object|market/i, 'The volunteered object is not a selected product target.');
  if (id === 'correction') assert.doesNotMatch(reply, /not a relocation|no relocation|never moved/i, 'Not from New York does not establish no relocation.');
}
function qualityNotes(proposal) {
  const parameterGroups = [/budget/i, /timeline|deadline|schedule/i, /structur(?:e|al)|preservation|permit|permission/i];
  return proposal.questionId === 'SCOPE_PARAMETERS' && parameterGroups.filter(pattern => pattern.test(proposal.text || '')).length > 1
    ? ['The scope question offers multiple parameters as examples/options. This is a style note; it could be shorter and more focused.'] : [];
}
async function main() {
  const side = process.argv.includes('--before') ? 'before' : 'after';
  const destination = path.resolve('.tmp/guided-conversation-quality-eval.json');
  const existing = fs.existsSync(destination) ? JSON.parse(fs.readFileSync(destination, 'utf8')) : {};
  const sequentialOnly = process.argv.includes('--sequential-only');
  const guided = load('src/lib/interview/guided/decision.ts'); const results = sequentialOnly ? existing[side] || [] : [];
  for (const fixture of sequentialOnly ? [] : fixtures) {
    calls = []; const start = Date.now();
    try {
      const proposal = await guided.proposeGuidedNext(fixture.session, fixture.parent, fixture.turn);
      if (side === 'after') checkQuality(fixture.id, proposal);
      const next = fixture.session.plan.find(value => value.status === 'pending');
      const continuation = proposal.kind === 'advance' ? next?.text ?? '(section complete)' : [proposal.reaction, proposal.text].filter(Boolean).join(' ');
      results.push({ fixture: fixture.id, expected: fixture.expected, proposal, continuation, qualityNotes: qualityNotes(proposal), calls, milliseconds: Date.now() - start });
      console.log(fixture.id, JSON.stringify({ proposal, continuation, inputTokens: calls.reduce((sum, call) => sum + call.inputTokens, 0), outputTokens: calls.reduce((sum, call) => sum + call.outputTokens, 0) }));
    } catch (error) { results.push({ fixture: fixture.id, error: error.message, calls }); console.log(fixture.id, 'FAILED', error.message); process.exitCode = 1; }
  }
  const sequential = [];
  if (side === 'after') {
    const controller = load('src/lib/interview/guided/controller.ts');
    let session = structuredClone(fixtures[0].session);
    session.plan = session.plan.filter(question => question.kind === 'prepared');
    session.turns = session.turns.slice(0, 1); session.pendingDecisionTurnId = session.turns[0].id;
    session.activeQuestionId = session.turns[0].questionId;
    for (let step = 0; step < 3; step++) {
      calls = [];
      try {
        const turn = session.turns.find(value => value.id === session.pendingDecisionTurnId);
        const parent = session.plan.find(value => value.id === turn.questionId);
        const proposal = await guided.proposeGuidedNext(session, parent, turn);
        checkQuality(`sequential-${step + 1}`, proposal);
        controller.applyDecision(session, proposal);
        const active = controller.currentQuestion(session);
        sequential.push({ step: step + 1, user: turn.text || '(Skip)', proposal, continuation: [active?.reaction, active?.text].filter(Boolean).join(' '), qualityNotes: qualityNotes(proposal), calls });
        console.log('sequential', step + 1, JSON.stringify(sequential.at(-1)));
        if (step < 2) {
          const answers = {
            SCOPE_PARAMETERS: 'The structure and exterior stayed. Inside we could change every room, but it all had to be ready before their move in September.',
            DESIGN_DIRECTION: 'We wanted the rooms to reveal their playful side in everyday use, with room for their collections and enough openness to feel relaxed.',
            CLIENT_BRIEF: 'They are playful collectors who also wanted the house to feel relaxed when it is just the two of them.',
            SIGNATURE_IDENTITY: 'The connection between intimate rooms and open shared spaces is the part that feels most like my approach.',
          };
          const action = step === 1 ? 'skip' : active.confirmation ? 'confirm' : 'answer';
          session = controller.acceptCommand(session, { action, version: session.version, requestId: `synthetic-step-${step}`,
            questionId: active.id, ...(action === 'answer' ? { text: answers[active.category] || 'The original floor plan became more open as we understood how they wanted to live.' } : {}) });
        }
      } catch (error) { sequential.push({ step: step + 1, error: error.message, calls }); console.log('sequential FAILED', error.message); process.exitCode = 1; break; }
    }
  }
  const promptHash = createHash('sha256').update(fs.readFileSync('src/lib/interview/guided/decision.ts')).update(fs.readFileSync('src/lib/interview/guided/decision.schemas.ts')).digest('hex');
  const metadata = { promptHash, capturedAt: new Date().toISOString() };
  fs.mkdirSync(path.dirname(destination), { recursive: true }); fs.writeFileSync(destination, JSON.stringify({ ...existing, [side]: results,
    ...(!sequentialOnly ? { [`${side}Metadata`]: metadata } : {}), ...(side === 'after' ? { sequential, sequentialMetadata: metadata } : {}) }, null, 2));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
