// Bounded actual-model conversation; synthetic designer and no database/Tavus calls.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const ts = require('typescript');
const assert = require('node:assert/strict');
if (!process.argv.includes('--live')) { console.log('Use --live to evaluate one synthetic podcast thread with the configured model.'); process.exit(0); }
require('dotenv').config({ path: '.env.local', quiet: true });
require('dotenv').config({ path: '.env', quiet: true });
const Anthropic = require('@anthropic-ai/sdk').default;
const destination = 'docs/reviews/project-guide/sequence-evaluation.json';
const evaluationBudget = { maxDesignerTurns: 8, maxModelCalls: 40 };
const sequenceStartedAt = Date.now();
const result = { capturedAt: new Date().toISOString(), boundary: 'Actual configured Anthropic decision/review calls and actual controller; synthetic designer, prepared project plan, no database, browser, Tavus, recording or room-plan generation.', status: 'running', turns: [], modelCalls: [], checks: [] };
result.evaluationBudget = evaluationBudget;
result.timingBoundary = 'Wall time measures synthetic answer acceptance through the next validated question, including concurrent provider work but excluding human speech, Tavus delivery and preparation. Provider milliseconds sum individual request durations and can exceed wall time when requests run in parallel.';
result.fixtureRevision = 'complete-project-reflection-v4';
result.fixtureNotes = 'All designer replies are authored fiction for this evaluation, not real designer statements. The original rich opening and courtyard consequence remain unchanged. Earlier v2/v3 revisions supplied coherent scope facts and allowed genuinely new application questions within known topics; those attempts remain preserved. V4 continues after the first consent through project-phase completion. The eight-turn limit and quality criteria are unchanged; the call cap is now 40 instead of 24 because factual and coverage audits run separately in parallel, increasing normal selections from three to four calls and repaired selections from five to seven. Earlier 24-call trials and their failures remain preserved. Replies are selected from the actual active question wording rather than its category alone, without imposing target order. Unknown requests stop the fixture instead of receiving a nonresponsive canned answer. Voice provenance remains mandatory for every confirmation, and an actual designer-reflection opportunity must be reached.';
result.sourceHashes = Object.fromEntries(['src/lib/ai/models.ts', 'src/lib/ai/cost.ts', 'src/lib/interview/guided/controller.ts', 'src/lib/interview/guided/decision.ts', 'src/lib/interview/guided/decision.schemas.ts', 'src/lib/interview/guided/coverage.ts', 'src/lib/interview/guided/coverage.schemas.ts', 'src/lib/interview/guided/factual-review.ts', 'src/lib/interview/guided/factual-review.schemas.ts', 'scripts/eval-project-guide-sequence.cjs'].map(file => [file, crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')]));
if (fs.existsSync(destination)) {
  const prior = JSON.parse(fs.readFileSync(destination, 'utf8'));
  result.previousAttempts = [...(prior.previousAttempts || []), { capturedAt: prior.capturedAt, status: prior.status, structuralStatus: prior.structuralStatus, error: prior.error, fixtureRevision: prior.fixtureRevision, fixtureNotes: prior.fixtureNotes, evaluationBudget: prior.evaluationBudget ?? { maxDesignerTurns: 8, maxModelCalls: 24 }, sourceHashes: prior.sourceHashes, turns: prior.turns, modelCalls: prior.modelCalls, qualityReview: prior.qualityReview, checks: prior.checks, wallMilliseconds: prior.wallMilliseconds, providerMilliseconds: prior.providerMilliseconds, estimatedCostUsd: prior.estimatedCostUsd, modelMetrics: prior.modelMetrics, timingBoundary: prior.timingBoundary }];
}
let modelCallsStarted = 0;
const pendingProviderCalls = new Set();
class RecordedAnthropic {
  constructor(options) { const client = new Anthropic(options); this.messages = { create: async request => {
    if (modelCallsStarted >= evaluationBudget.maxModelCalls) throw Error('Evaluation call budget reached.');
    const requestNumber = ++modelCallsStarted;
    const started = Date.now();
    const providerCall = client.messages.create(request);
    pendingProviderCalls.add(providerCall);
    try {
      const response = await providerCall;
      result.modelCalls.push({ requestNumber, model: response.model, thinkingType: request.thinking?.type, effort: request.output_config?.effort, maxTokens: request.max_tokens, inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens,
        cacheReadInputTokens: response.usage.cache_read_input_tokens ?? 0, cacheCreationInputTokens: response.usage.cache_creation_input_tokens ?? 0,
        estimatedCostUsd: load('src/lib/ai/cost.ts').anthropicCostUsd(response.model, response.usage),
        input: JSON.parse(request.messages[0].content),
        milliseconds: Date.now() - started, output: response.content.filter(item => item.type === 'text').map(item => item.text).join('') });
      return response;
    } catch (error) {
      result.modelCalls.push({ requestNumber, model: request.model, thinkingType: request.thinking?.type, effort: request.output_config?.effort, maxTokens: request.max_tokens, input: JSON.parse(request.messages[0].content), milliseconds: Date.now() - started, error: error.name });
      throw error;
    } finally {
      pendingProviderCalls.delete(providerCall);
    }
  } }; }
}
const cache = new Map();
function load(file) {
  file = path.resolve(file); if (cache.has(file)) return cache.get(file);
  const exports = {}; cache.set(file, exports);
  const source = fs.readFileSync(file, 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  vm.runInNewContext(code, { exports, process, console, Error, structuredClone, setTimeout, clearTimeout, require(name) {
    if (name === '@anthropic-ai/sdk') return { default: RecordedAnthropic, __esModule: true };
    if (name === '@/lib/prisma') return { prisma: new Proxy({}, { get() { throw Error('DB forbidden in conversation evaluation'); } }) };
    if (name === '@/lib/ai/cost') return { ...load('src/lib/ai/cost.ts'), recordCostEvent: async () => {} };
    if (name === 'server-only') return {};
    if (name.startsWith('@/')) return load(path.resolve('src', name.slice(2)) + '.ts');
    if (name.startsWith('.')) return load(path.resolve(path.dirname(file), name) + '.ts');
    return require(name);
  } }, { filename: file }); return exports;
}
function save() {
  result.wallMilliseconds = Date.now() - sequenceStartedAt;
  result.providerMilliseconds = result.modelCalls.reduce((total, call) => total + call.milliseconds, 0);
  result.estimatedCostUsd = result.modelCalls.reduce((total, call) => total + (call.estimatedCostUsd ?? 0), 0);
  result.modelMetrics = result.modelCalls.reduce((metrics, call) => {
    const entry = metrics[call.model] ??= { calls: 0, inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0 };
    entry.calls++; entry.inputTokens += call.inputTokens ?? 0; entry.outputTokens += call.outputTokens ?? 0; entry.estimatedCostUsd += call.estimatedCostUsd ?? 0;
    return metrics;
  }, {});
  for (const turn of result.turns.filter(item => item.wallMilliseconds === undefined)) {
    turn.wallMilliseconds = Date.now() - Date.parse(turn.startedAt);
    turn.providerMilliseconds = result.modelCalls.slice(turn.firstModelCall).reduce((total, call) => total + call.milliseconds, 0);
    turn.estimatedCostUsd = result.modelCalls.slice(turn.firstModelCall).reduce((total, call) => total + (call.estimatedCostUsd ?? 0), 0);
  }
  fs.mkdirSync(path.dirname(destination), { recursive: true }); fs.writeFileSync(destination, JSON.stringify(result, null, 2) + '\n');
}
async function main() {
  const controller = load('src/lib/interview/guided/controller.ts');
  const decision = load('src/lib/interview/guided/decision.ts');
  const fixture = structuredClone(require('./fixtures/podcast-interview-quality.cjs')[0]);
  const plan = fixture.session.plan.filter(question => question.kind === 'prepared');
  const originalIds = plan.map(question => question.id);
  const start = { action: 'start', requestId: 'sequence-start-01', version: 0, conversationStyle: 'podcast' };
  let session = controller.createGuidedSession('synthetic-podcast-sequence', { questions: plan, rooms: fixture.session.rooms, contextFingerprint: 'synthetic-sequence', minimumTotalAnswers: 5 }, start.requestId, start);
  const answers = {
    opening: 'The clients wanted more privacy without disconnecting the rooms. We kept the footprint and moved two internal walls. The idea was a clear path from shared life to privacy. Halfway through demolition, we discovered a sealed courtyard behind the kitchen, and that changed the design.',
    consequence: 'We reopened the courtyard and redirected the kitchen circulation around it. That gave the clients a private outdoor place while keeping a connection between the kitchen and the living spaces.',
    scope: 'We had ten months from design through completion. The clients set a fixed budget and wanted to keep the existing footprint. The two internal walls we moved were not load-bearing, and we kept the exterior structure. Those were the limits we worked within.',
    application: 'The idea was a clear path from shared life to privacy. Beyond the courtyard, we put a reading room at the quieter end of the hall and used sliding doors so it could close for quiet while the main living room remained open. That was how the idea shaped the other rooms.',
    reflection: 'I tend to make privacy a choice rather than a hard separation. Here you can close the reading room for a quiet hour and still be a few steps from everyone else. That balance is probably the part that feels most like my work.',
  };
  result.syntheticFixtureAnswers = answers;
  let followups = 0; let returned = false; let confirmed = false; let reflectionAnswered = false;
  for (let index = 0; index < evaluationBudget.maxDesignerTurns; index++) {
    const question = controller.currentQuestion(session);
    if (!question && controller.projectPhaseComplete(session)) break;
    assert.ok(question, 'A sequential turn must have an actual active question.');
    let fixtureAnswerKey;
    const wording = question.text.toLowerCase();
    if (question.confirmation) fixtureAnswerKey = 'confirmation';
    else if (index === 0) fixtureAnswerKey = 'opening';
    else if (/recogniz|recognis|yours|signature|your (?:work|approach|practice|point of view|own|sensibility)|particular to you|distinctly you|as a designer|most like you|important to you|what.*(?:learn|teach)/.test(wording)) fixtureAnswerKey = 'reflection';
    else if (/working within|scope|budget|timeline|schedule|structur|constraint|limit|footprint|non-negotiable/.test(wording)) fixtureAnswerKey = 'scope';
    else if (/room by room|other rooms|reading room|sliding|hall|beyond.*courtyard|idea.*play out|idea.*guide/.test(wording)) fixtureAnswerKey = 'application';
    else if (/courtyard|discov|finding|found|pivot/.test(wording)) fixtureAnswerKey = 'consequence';
    else if (/design idea|design direction|overall idea|concept|clear path|privacy|shared life/.test(wording)) fixtureAnswerKey = 'application';
    else throw Error(`Synthetic fixture needs an authored reply to the actual question: ${question.text}`);
    const text = fixtureAnswerKey === 'confirmation' ? 'Yes, exactly.' : answers[fixtureAnswerKey];
    if (fixtureAnswerKey === 'reflection') reflectionAnswered = true;
    const command = { action: 'answer', requestId: `sequence-answer-${index + 1}`, version: session.version, sessionId: session.id, questionId: question.id, text, inputModality: 'voice' };
    const turnStartedAt = new Date().toISOString();
    session = controller.acceptCommand(session, command);
    result.finalSession = session;
    const turn = session.turns.at(-1);
    const entry = { startedAt: turnStartedAt, firstModelCall: result.modelCalls.length, questionId: question.id, question: question.text, category: question.category, questionKind: question.kind, fixtureAnswerKey, designerReply: text, acceptedTurn: structuredClone(turn) };
    result.turns.push(entry);
    assert.equal(turn.questionId, question.id);
    if (question.confirmation) {
      assert.equal(turn.kind, 'confirmation'); assert.equal(turn.text, question.confirmation.quote);
      assert.equal(turn.reusedFromAnswerId, question.confirmation.answerId);
      assert.equal(turn.inputModality, 'voice'); assert.equal(turn.confirmationText, text); confirmed = true;
      entry.after = 'Designer explicitly confirmed the exact earlier raw evidence; no generated answer was substituted.';
    }
    const proposal = await decision.proposeGuidedNext(session, session.plan.find(item => item.id === question.id), turn);
    entry.proposal = proposal;
    if (index === 0) assert.equal(proposal.kind, 'followup', 'Rich opening should stay with the volunteered discovery.');
    if (proposal.kind === 'followup' || proposal.kind === 'clarification') followups++;
    if (followups && ['ask_prepared', 'confirm_coverage'].includes(proposal.kind)) returned = true;
    const accepted = controller.acceptedTurns(session);
    for (const evidence of proposal.evidence || []) {
      const source = accepted.find(item => item.id === evidence.answerId);
      assert.ok(source && source.text.includes(evidence.quote), 'Every factual evidence quote resolves to an accepted exact answer.');
    }
    controller.applyDecision(session, proposal);
    assert.deepEqual(session.plan.filter(item => item.kind === 'prepared').map(item => item.id), originalIds, 'Followups must preserve every original backbone ID.');
    entry.nextQuestion = structuredClone(controller.currentQuestion(session));
    console.log(`Turn ${index + 1}: ${proposal.kind} — ${entry.nextQuestion?.text || 'No next question'}`);
    save();
  }
  assert.ok(followups >= 1, 'A real followup occurred.');
  assert.ok(returned, 'The actual sequence returned to a prepared obligation.');
  assert.ok(controller.projectPhaseComplete(session) && !controller.currentQuestion(session), 'The expanded project phase must finish within the bounded eight-turn/40-call evaluation.');
  assert.ok(reflectionAnswered, 'The expanded conversation must invite and accept an actual designer-reflection answer.');
  const adaptedAnswers = session.plan.filter(question => question.kind === 'prepared' && question.status === 'answered' && question.adaptation && question.sourceAnswerIds.length);
  assert.ok(confirmed || adaptedAnswers.length, 'A covered topic must either be explicitly confirmed or receive additional evidence through a source-linked adaptation.');
  const pending = session.plan.filter(question => ['active', 'pending'].includes(question.status));
  assert.ok(pending.some(question => question.kind === 'prepared') || controller.projectPhaseComplete(session), 'Unanswered backbone obligations remain available unless the project phase is covered.');
  assert.deepEqual(session.plan.filter(item => item.kind === 'prepared').map(item => item.id), originalIds);
  assert.ok(controller.acceptedTurns(session).some(turn => turn.text === answers.opening), 'The original rich answer remains accepted evidence.');
  for (const question of session.plan.filter(item => item.kind === 'prepared' && item.status === 'answered')) assert.ok(controller.acceptedTurns(session).some(turn => turn.questionId === question.id), 'No backbone topic is marked answered without accepted designer evidence.');
  result.checks = ['actual model followed the opening discovery', 'subsequent turns used the controller-generated active question', 'resolved tangent returned to an unanswered prepared obligation', 'all proposal evidence quoted accepted raw answers exactly', confirmed ? 'voice coverage confirmations saved their explicit exact source and literal words' : 'source-linked adapted backbone question recorded additional designer evidence', 'original rich answer and prepared IDs preserved', 'project phase completed and actual designer reflection accepted within the stated call/turn bounds'];
  result.finalSession = session;
  result.status = 'structural_checks_passed';
  result.qualityReview = { status: 'pending', criteria: 'Independently read the full conversation for genuinely new requested information, no invented premise or causal link, resolved threads returning to the backbone, and preservation of known evidence. A topic label or wording such as beyond is not proof of novelty.' };
  result.limitations = ['One synthetic conversation thread, not general quality or latency proof.', 'Preparation and room generation were not evaluated; the recorded sequence covers the project-phase thread only.', 'Database persistence, browser delivery and Tavus audiovisual behavior were not exercised. Voice modality is supplied to the real controller using synthetic transcribed strings.', 'Historical failures are preserved under previousAttempts; structural checks alone do not establish conversational quality.'];
  save(); console.log(`PASS structural sequence checks: ${result.turns.length} designer turns, ${result.modelCalls.length} real model calls. Independent semantic review remains required.`);
}
main().catch(async error => { await Promise.allSettled([...pendingProviderCalls]); result.status = 'failed'; result.error = error.message; save(); console.error(error.message); process.exitCode = 1; });
