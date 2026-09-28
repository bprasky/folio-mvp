const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const fixtures = require('./fixtures/guided-conversation-quality.cjs');
const cache = new Map();
let responses = [], requests = [], projectFixture;
const environment = { ANTHROPIC_API_KEY: 'synthetic-test-only' };
function load(file) {
  file = path.resolve(file); if (cache.has(file)) return cache.get(file);
  const exports = {}; cache.set(file, exports);
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  vm.runInNewContext(code, { exports, process: { env: environment }, console, Error, structuredClone, setTimeout, clearTimeout, require(name) {
    if (name === '@/lib/prisma') return { prisma: { project: { findUnique: async () => projectFixture } } };
    if (name === '@/lib/ai/cost') return { anthropicCostUsd: () => 0, recordCostEvent: async () => {} };
    if (name === '@anthropic-ai/sdk') return class { messages = { create: async request => {
      requests.push(request); assert.ok(responses.length, 'Unexpected provider call'); const response = responses.shift();
      if (response instanceof Error) throw response;
      return { model: 'synthetic', stop_reason: 'end_turn', usage: { input_tokens: 1, output_tokens: 1 }, content: [{ type: 'text', text: typeof response === 'string' ? response : JSON.stringify(response) }] };
    } }; };
    if (name.startsWith('@/')) return load(path.resolve('src', name.slice(2)) + '.ts');
    if (name.startsWith('.')) return load(path.resolve(path.dirname(file), name) + '.ts');
    return require(name);
  } }, { filename: file }); return exports;
}
const prep = load('src/lib/interview/guided/preparation.ts');
const decision = load('src/lib/interview/guided/decision.ts');
const controller = load('src/lib/interview/guided/controller.ts');
const room = { id: 'r1', name: 'Living Room', imageIds: ['photo1'], baseQuestions: 3, maxFollowUps: 1 };
const goodReview = { valid: true, reason: 'One grounded question fits the remaining obligation.' };
const candidate = (id, text, extras = {}) => ({ id, text, products: [], vendors: [], topic: id, ...extras });
function ask(fixture, text, evidence = [{ answerId: fixture.turn.id, quote: fixture.turn.text }]) {
  return { kind: 'ask_prepared', questionId: controller.eligiblePreparedQuestions(fixture.session)[0].id,
    text, purpose: 'Collect the remaining part of this prepared obligation.', sourceAnswerIds: [...new Set(evidence.map(item => item.answerId))], evidence };
}
async function run() {
  const project = prep.adaptGuidedProjectQuestions([
    candidate('project-CLIENT_BRIEF-preserved', 'Who was this project for?'), null,
    { id: 'project-SCOPE_PARAMETERS-invalid', text: 12 },
    candidate('project-DESIGN_DIRECTION-preserved', 'What was the overall design idea for this project?'),
  ], ['photo1']);
  assert.equal(project.length, 5); assert.equal(new Set(project.map(q => q.category)).size, 5);
  assert.equal(project[0].id, 'project-CLIENT_BRIEF-preserved');
  assert.equal(project[2].id, 'project-DESIGN_DIRECTION-preserved');
  assert.equal(project[0].preparedText, 'Who was this project for?');
  assert.ok(project.every(q => q.baselineText), 'Correction-safe baselines exist for every obligation.');
  const malformed = prep.adaptGuidedRoomQuestions([
    candidate('first-valid-id', 'What shaped the layout of this room?'), { id: 'bad', text: 42 }, null,
    candidate('last-valid-id', 'How did you want this room to support daily life?'),
  ], room);
  assert.equal(malformed.length, 4); assert.equal(malformed[0].id, 'first-valid-id'); assert.equal(malformed[3].id, 'last-valid-id');
  assert.equal(malformed[1].preparationStatus, 'safe_fallback');
  assert.equal(prep.adaptGuidedRoomQuestions([], room).length, 3);
  assert.ok(malformed.every(q => q.sourceImageIds[0] === 'photo1'));

  const contextual = candidate('contextual', 'How did the living room make space for reading together?', { topic: 'room_use' });
  const unsafe = candidate('unsafe-product', 'Why did you choose the brass fixture?', { topic: 'room_layout' });
  const evidence = [{ answerId: 'project-answer', quote: 'We wanted to read together.' }];
  responses = [
    { reviews: [{ id: contextual.id, valid: true, reason: 'Room use grounded in the accepted brief.', evidence }, { id: unsafe.id, valid: false, reason: 'Unselected product target.', evidence: [] }] },
    { questions: [{ id: unsafe.id, text: 'How did you arrange the room for reading together?' }] },
    { reviews: [{ id: unsafe.id, valid: true, reason: 'Room-wide spatial arrangement.', evidence }] },
  ]; requests = [];
  const receipts = await prep.reviewPreparedQuestions([contextual, null, unsafe], { scope: 'room', acceptedAnswers: [{ id: 'project-answer', question: 'Brief?', answer: 'We wanted to read together.' }] }, 'synthetic');
  const prepared = prep.adaptGuidedRoomQuestions([contextual, null, unsafe], room, receipts);
  assert.equal(requests.length, 3); assert.equal(prepared[0].text, contextual.text, 'Natural contextual wording survives meaningful review.');
  assert.equal(prepared[2].id, unsafe.id); assert.equal(prepared[2].category, 'room_layout', 'Repair preserves the original obligation category.');
  assert.equal(prepared[2].preparedText, unsafe.text); assert.equal(prepared[2].text, 'How did you arrange the room for reading together?');
  assert.equal(prepared[0].sourceAnswerIds.join(','), 'project-answer'); assert.equal(prepared[0].adaptation.evidence[0].quote, evidence[0].quote);
  assert.notEqual(prepared[0].baselineText, prepared[0].text); assert.equal(prepared[1].sourceAnswerIds.length, 0);
  responses = [{ reviews: [{ id: contextual.id, valid: true, reason: 'Safe.', evidence }, { id: unsafe.id, valid: false, reason: 'Product target.', evidence: [] }] }, new Error('repair outage')];
  const partial = await prep.reviewPreparedQuestions([contextual, unsafe], { acceptedAnswers: [{ id: 'project-answer', question: 'Brief?', answer: 'We wanted to read together.' }] }, 'synthetic');
  assert.equal(partial.get(contextual.id).text, contextual.text, 'Repair failure cannot erase a validated neighbor.'); assert.equal(partial.has(unsafe.id), false);

  const replies = [
    ask(fixtures[0], 'Keeping the bones and redesigning every space was the full scope?', [{ answerId: 'broad-answer', quote: 'They wanted to keep the bones of the house but redesign every space.' }]),
    { ...ask(fixtures[1], 'Was a clear path from shared life to privacy the central design idea?', [{ answerId: 'concise-scope', quote: 'The idea was a clear path from shared life to privacy.' }]), kind: 'confirm_coverage' },
    ask(fixtures[2], 'What could you change within the existing structure?'),
    ask(fixtures[3], 'Moving into the Kitchen, what did you want that room to make possible?', []),
    ask(fixtures[4], 'How did you arrange the room for homework after school?', [{ answerId: 'product-brief', quote: 'The family wanted somewhere to gather after school, and enough room to spread out with homework.' }]),
  ];
  for (let index = 0; index < fixtures.length; index++) {
    const fixture = fixtures[index]; responses = [replies[index], goodReview]; requests = [];
    const result = await decision.proposeGuidedNext(fixture.session, fixture.parent, fixture.turn);
    assert.equal(result.text, replies[index].text); assert.equal(requests.length, 2, 'Independent review runs after proposal validation.');
    const input = JSON.parse(requests[0].messages[0].content);
    assert.equal(Object.keys(requests[0].output_config.format.schema.properties).slice(0, 3).join(','), 'purpose,evidence,sourceAnswerIds', 'The provider assesses coverage and selects evidence before composing its action or wording.');
    assert.equal(input.acceptedConversation.length, fixture.session.turns.filter(turn => !turn.supersededBy).length);
    assert.ok(input.remainingPreparedQuestions.length); assert.equal(JSON.parse(requests[1].messages[0].content).candidate.text, result.text);
    assert.ok(requests[1].output_config.format, 'Native structured output protects review parsing.');
  }
  const fixture = fixtures[0], valid = replies[0];
  for (const bad of [
    { ...valid, questionId: 'unavailable' }, { ...valid, sourceAnswerIds: ['missing'] },
    { ...valid, evidence: [{ answerId: 'broad-answer', quote: 'invented quote' }] },
    { ...valid, text: 'What changed? Why?' }, { kind: 'covered', questionId: valid.questionId }, { kind: 'advance' }, 'invalid JSON',
  ]) assert.throws(() => decision.validateGuidedDecision(bad, fixture.session, fixture.parent, fixture.turn));
  const crossRoom = { ...replies[3], sourceAnswerIds: ['living-2'], evidence: [{ answerId: 'living-2', quote: fixtures[3].turn.text }] };
  assert.throws(() => decision.validateGuidedDecision(crossRoom, fixtures[3].session, fixtures[3].parent, fixtures[3].turn));
  const fullRoom = decision.guidedDecisionContext(fixtures[3].session, fixtures[3].parent, fixtures[3].turn);
  assert.equal(fullRoom.followupPermitted, false, 'Completed room transitions do not insert another optional detour.');
  const rejected = { ...valid, text: 'Why did you select the anonymous curved object in the corner?' };
  responses = [rejected, { valid: false, reason: 'Unselected product by descriptor.' }, valid, goodReview]; requests = [];
  assert.equal((await decision.proposeGuidedNext(fixture.session, fixture.parent, fixture.turn)).text, valid.text); assert.equal(requests.length, 4);
  assert.equal(JSON.parse(requests[2].messages[0].content).repairRequired.rejectedProposal, JSON.stringify(rejected), 'Repair sees the actual rejected wording, not an orphaned critique.');
  responses = [rejected, { valid: false, reason: 'Unselected target.' }, rejected, { valid: false, reason: 'Still an unselected target.' }];
  await assert.rejects(decision.proposeGuidedNext(fixture.session, fixture.parent, fixture.turn), /saved answer needs/);
  responses = [new Error('provider outage')]; await assert.rejects(decision.proposeGuidedNext(fixture.session, fixture.parent, fixture.turn), /provider outage/);
  environment.ANTHROPIC_ENABLED = 'false'; await assert.rejects(decision.proposeGuidedNext(fixture.session, fixture.parent, fixture.turn), /unavailable/); delete environment.ANTHROPIC_ENABLED;

  const skipped = structuredClone(fixture); skipped.turn = { ...skipped.turn, kind: 'skip', text: 'skip' };
  skipped.session.turns[1] = skipped.turn; skipped.parent = { ...skipped.parent, status: 'skipped' }; skipped.session.plan[1] = skipped.parent;
  responses = [valid, goodReview]; assert.equal((await decision.proposeGuidedNext(skipped.session, skipped.parent, skipped.turn)).kind, 'ask_prepared');
  const request = decision.guidedDecisionContext(fixtures[2].session, fixtures[2].parent, fixtures[2].turn);
  assert.equal(request.acceptedConversation.some(answer => answer.id === 'outdated-client'), false, 'Superseded facts are absent from active evidence.');
  const last = structuredClone(fixtures[2]); last.session.plan = [last.parent];
  const followup = { kind: 'clarification', text: 'What did privacy mean for the clients here?', purpose: 'Clarify the meaning of the stated privacy intention.', sourceAnswerIds: [last.turn.id], evidence: [{ answerId: last.turn.id, quote: 'They wanted more privacy without making the rooms feel disconnected.' }] };
  responses = [followup, goodReview]; requests = [];
  await decision.proposeGuidedNext(last.session, last.parent, last.turn);
  const followupReview = JSON.parse(requests[1].messages[0].content).context;
  assert.equal(followupReview.target.category, last.parent.category); assert.equal(followupReview.target.roomId, last.parent.roomId);
  assert.equal(followupReview.target.text, last.parent.text, 'Independent semantic review knows the follow-up scope.');
  assert.equal(decision.guidedTurnWantsToMoveOn("Let's move on."), true); assert.equal(decision.guidedTurnWantsToMoveOn('We moved on from the old layout.'), false);

  projectFixture = { id: 'p1', title: 'Synthetic', rooms: [{ id: 'r1', name: 'Living Room', selections: [] }, { id: 'r2', name: 'Living Room', selections: [] }], images: [
    { id: 'photo1', url: 'https://example.invalid/1.jpg', roomId: 'r1', room: 'Living Room', tags: [] },
    { id: 'photo2', url: 'https://example.invalid/2.jpg', roomId: null, room: 'Living Room', tags: [] },
    { id: 'photo3', url: 'https://example.invalid/3.jpg', roomId: null, room: 'r2', tags: [] },
  ] };
  const scoped = await prep.readGuidedContext('p1');
  assert.equal(scoped.rooms[0].imageIds.join(','), 'photo1'); assert.equal(scoped.rooms[1].imageIds.join(','), 'photo3'); assert.equal(scoped.images[1].roomId, null);
  projectFixture.images[0].roomId = 'r2'; assert.notEqual((await prep.readGuidedContext('p1')).contextFingerprint, scoped.contextFingerprint);
  await assert.rejects(prep.prepareGuidedRoomPlan('p1', { projectId: 'p1', roomsPrepared: false, plan: [{ roomId: null, status: 'active' }] }), /Finish the prepared project section/);
  console.log('Guided prompt checks passed: contextual preparation/review/repair, preserved obligations and evidence, five multi-turn contexts, confirmation, corrections, skip adaptation, room transitions, semantic rejection, bounded retry and provider failure.');
}
run().catch(error => { console.error(error); process.exitCode = 1; });
