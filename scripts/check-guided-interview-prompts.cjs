const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const fixtures = require('./fixtures/guided-conversation-quality.cjs');
const cache = new Map();
let responses = [], factualResponses = [], requests = [], projectFixture;
const environment = { ANTHROPIC_API_KEY: 'synthetic-test-only' };
function load(file) {
  file = path.resolve(file); if (cache.has(file)) return cache.get(file);
  const exports = {}; cache.set(file, exports);
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  vm.runInNewContext(code, { exports, process: { env: environment }, console, Error, structuredClone, setTimeout, clearTimeout, require(name) {
    if (name === '@/lib/prisma') return { prisma: { project: { findUnique: async () => projectFixture } } };
    if (name === '@/lib/ai/cost') return { anthropicCostUsd: () => 0, recordCostEvent: async () => {} };
    if (name === '@anthropic-ai/sdk') return class { messages = { create: async request => {
      requests.push(request);
      const factualCall = request.system === factual.PODCAST_FACTUAL_REVIEW_PROMPT;
      if (!factualCall) assert.ok(responses.length, 'Unexpected provider call');
      let response = factualCall ? (factualResponses.length ? factualResponses.shift() : goodFacts) : responses.shift();
      if (typeof response === 'function') response = await response(request);
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
const coverage = load('src/lib/interview/guided/coverage.ts');
const factual = load('src/lib/interview/guided/factual-review.ts');
const models = load('src/lib/ai/models.ts');
const decisionSchemas = load('src/lib/interview/guided/decision.schemas.ts');
const room = { id: 'r1', name: 'Living Room', imageIds: ['photo1'], baseQuestions: 3, maxFollowUps: 1 };
const goodReview = { valid: true, reason: 'One grounded question fits the remaining obligation.' };
const goodFacts = { valid: true, reason: 'The spoken factual premises are supported by the cited passages.' };
const candidate = (id, text, extras = {}) => ({ id, text, products: [], vendors: [], topic: id, ...extras });
function ask(fixture, text, evidence = [{ answerId: fixture.turn.id, quote: fixture.turn.text }]) {
  return { kind: 'ask_prepared', questionId: controller.eligiblePreparedQuestions(fixture.session)[0].id,
    text, purpose: 'Collect the remaining part of this prepared obligation.', sourceAnswerIds: [...new Set(evidence.map(item => item.answerId))], evidence };
}
async function run() {
  responses = [{ questions: [
    null, { text: 42 },
    { text: 'How did the stone and timber palette shape the atmosphere?', type: 'material_thread', products: [], vendors: [], boostable: false },
    { text: 'Why did you select the Marble Table by Vendor Co?', type: 'deep_dive', products: ['Marble Table'], vendors: ['Vendor Co'], boostable: false },
    { text: 'What keeps you returning to this supplier?', type: 'vendor_loyalty', products: [], vendors: [], boostable: false },
  ] }]; requests = [];
  const generalRoom = await load('src/lib/interview/generateRoomQuestions.ts').generateRoomQuestions({
    roomName: 'Living Room', roomImages: [], budget: 3, contextLevel: 2,
    projectContext: { materialPalette: ['natural_stone', 'warm_wood'], otherRoomNames: [] },
  });
  assert.equal(generalRoom.questions.length, 1, 'General prep rejects commercial product/vendor responses.');
  assert.equal(generalRoom.questions[0].type, 'material_theme');
  assert.equal(generalRoom.questions[0].products.length, 0); assert.equal(generalRoom.questions[0].vendors.length, 0);
  const roomPrompt = requests[0].messages[0].content.find(block => block.type === 'text').text;
  assert.ok(roomPrompt.includes('natural_stone')); assert.ok(roomPrompt.includes('cross-check what the photos and image analysis suggest'));
  assert.ok(roomPrompt.includes('Do not ask about specific products')); assert.ok(!roomPrompt.includes('MAY NAME AND SPOTLIGHT'));
  responses = [{ questions: [] }]; requests = [];
  await load('src/lib/interview/generateProjectQuestions.ts').generateProjectQuestions({
    representativeImages: [], roomNames: ['Living Room'], roomTypes: [], materialPalette: ['natural_stone'], contextLevel: 2,
  });
  assert.ok(requests[0].messages[0].content.find(block => block.type === 'text').text.includes('Do not ask about specific products'));
  responses = []; requests = [];
  console.log('PASS material context supports visual observations; general preparation excludes product spotlights and testimonials');

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
  const terminalSession = structuredClone(fixture.session);
  for (const question of terminalSession.plan) question.status = 'answered';
  const providerAdvance = { purpose: 'Pivot and its consequence are already resolved by prior answers; no remaining prepared obligations exist, so move forward.', kind: 'advance' };
  const canonicalAdvance = decision.validateGuidedDecision(providerAdvance, terminalSession, fixture.parent, fixture.turn);
  assert.equal(JSON.stringify(canonicalAdvance), '{"kind":"advance"}', 'Optional provider purpose is accepted only as nonspoken metadata and removed from canonical advance.');
  for (const invalidAdvance of [{ ...providerAdvance, text: 'Another question?' }, { ...providerAdvance, evidence: [] },
    { ...providerAdvance, purpose: 42 }, { ...providerAdvance, unknown: true }])
    assert.throws(() => decision.validateGuidedDecision(invalidAdvance, terminalSession, fixture.parent, fixture.turn));
  assert.throws(() => decision.validateGuidedDecision({ ...valid, unknown: true }, fixture.session, fixture.parent, fixture.turn), /unrecognized/,
    'Advance normalization does not strip unknown fields or loosen other decision variants.');
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

  const podcast = require('./fixtures/podcast-interview-quality.cjs')[0];
  const podcastReply = { kind: 'followup', text: 'How did finding the courtyard change what you designed?',
    purpose: 'Follow the untold consequence of the discovery before returning to the backbone.',
    sourceAnswerIds: [podcast.turn.id], evidence: [{ answerId: podcast.turn.id,
      quote: 'Halfway through demolition, we discovered a sealed courtyard behind the kitchen, and suddenly the whole brief changed.' }] };
  const podcastReview = { requestedInformation: 'How the discovery changed the design.', evidence: [], coverage: 'absent',
    remainingGap: 'The consequence of the discovery.', ...goodReview };
  let resolveProposal, resolveConversationReview;
  responses = [() => new Promise(resolve => { resolveProposal = resolve; }), () => {
    assert.equal(requests.length, 2, 'Coverage starts while the first proposal remains unresolved.');
    resolveProposal(podcastReply); return { covered: [{ questionId: 'SURPRISE_PIVOT', ...podcastReply.evidence[0] }] };
  }, () => new Promise(resolve => { resolveConversationReview = resolve; })];
  factualResponses = [() => {
    assert.equal(requests.length, 4, 'The factual audit starts while the conversation audit remains unresolved.');
    resolveConversationReview(podcastReview); return goodFacts;
  }]; requests = [];
  assert.equal((await decision.proposeGuidedNext(podcast.session, podcast.parent, podcast.turn)).kind, 'followup');
  assert.equal(requests.length, 4, 'Podcast extraction shares the proposal wave; factual and conversation audits share the second wave.');
  assert.equal(requests[0].system, decision.PODCAST_DECISION_PROMPT);
  assert.equal('reaction' in requests[0].output_config.format.schema.properties, false, 'Podcast grammar excludes ornamental reactions.');
  assert.equal(requests[1].system, coverage.PODCAST_COVERAGE_PROMPT);
  assert.equal(requests[2].system, decision.PODCAST_REVIEW_PROMPT);
  assert.equal(Object.keys(requests[2].output_config.format.schema.properties).join(','), 'requestedInformation,evidence,coverage,remainingGap,reason,valid', 'Conversation audit assesses coverage and fit before one final verdict.');
  assert.equal(requests[3].system, factual.PODCAST_FACTUAL_REVIEW_PROMPT);
  assert.equal(requests[3].model, models.MODEL_FOR.interviewGrounding, 'Factual audit uses its dedicated task class.');
  assert.equal(requests[3].model, models.MODELS.opus, 'The measured grounding exception is scoped to factual entailment.');
  assert.equal(requests[3].thinking.type, 'adaptive', 'Only the isolated factual audit opts into measured reasoning.');
  assert.equal(requests[3].output_config.effort, 'medium');
  assert.equal(requests[3].max_tokens, 2400, 'Reasoning needs headroom before the short structured verdict.');
  for (const otherRequest of requests.slice(0, 3)) {
    assert.equal(otherRequest.model, models.MODEL_FOR.interview, 'Generation, coverage and conversation-fit retain the interview model.');
    assert.equal(otherRequest.model, models.MODELS.sonnet);
    assert.equal(otherRequest.thinking.type, 'disabled', 'Generation, coverage and conversation-fit stay thinking-disabled.');
    assert.equal(otherRequest.output_config?.effort, undefined);
  }
  const factualInput = JSON.parse(requests[3].messages[0].content);
  assert.equal(Object.keys(factualInput).join(','), 'question,citedPassages,knownRoomNames', 'Factual audit cannot be primed by target, kind, collection labels, reuse rationale or the full interview plan.');
  assert.equal(factualInput.question, podcastReply.text);
  assert.equal(factualInput.citedPassages.join(','), podcastReply.evidence.map(value => value.quote).join(','));
  assert.equal(factualInput.knownRoomNames.join(','), podcast.session.rooms.map(value => value.name).join(','));
  assert.equal(JSON.parse(requests[2].messages[0].content).context.conversationStyle, 'podcast');
  assert.equal('purpose' in JSON.parse(requests[2].messages[0].content).candidate, false, 'A proposer justification cannot prime the independent auditor or be mistaken for spoken wording.');
  const podcastFollowupContext = JSON.parse(requests[2].messages[0].content).context;
  for (const field of ['currentAction', 'target', 'remainingPreparedQuestions', 'supportedPendingCoverage', 'supportedTargetCoverage'])
    assert.equal(field in podcastFollowupContext, false, 'A followup auditor receives no future target or prepared-plan routing task.');
  assert.equal(podcastFollowupContext.currentQuestion.text, podcast.parent.text);
  assert.equal(podcastFollowupContext.currentAnswer.id, podcast.turn.id);
  const regular = { ...podcast.session, conversationStyle: undefined };
  assert.equal(decision.buildGuidedDecisionRequest(regular, podcast.parent, podcast.turn).system, decision.GUIDED_DECISION_PROMPT);
  assert.throws(() => decision.validateGuidedDecision({ ...podcastReply, evidence: [{ answerId: podcast.turn.id, quote: 'The courtyard had marble columns.' }] }, podcast.session, podcast.parent, podcast.turn), /inexact/);
  assert.throws(() => decision.validateGuidedDecision({ ...podcastReply, reaction: 'That changed everything overnight.' }, podcast.session, podcast.parent, podcast.turn), /separate reaction/);

  // Protocol regression, not a model-quality evaluation: review needs the full
  // thread even when a neutral return to the backbone has no factual citations.
  const settledPodcast = require('./fixtures/podcast-interview-quality.cjs')[1];
  const repeatedPodcast = { kind: 'followup', text: 'What else can you tell me about the collection?',
    purpose: 'Ask for another detail about the collection.', sourceAnswerIds: [settledPodcast.turn.id],
    evidence: [{ answerId: settledPodcast.turn.id, quote: settledPodcast.turn.text }] };
  const neutralReturn = { kind: 'ask_prepared', questionId: 'SIGNATURE_IDENTITY',
    purpose: 'The tangent is resolved; collect the pending authorship obligation.',
    text: 'What in this project is most recognizably yours?', sourceAnswerIds: [], evidence: [] };
  responses = [repeatedPodcast, { covered: [{ questionId: 'DESIGN_DIRECTION', answerId: 'broad-answer',
    quote: 'The exterior should stay quiet; inside, they wanted it to feel personal and show their personalities.' }] },
    { ...podcastReview, valid: false, reason: 'The designer has already resolved this thread.' }, neutralReturn,
    { ...podcastReview, requestedInformation: 'Designer authorship.', remainingGap: 'The part most recognizably theirs.' }]; requests = [];
  assert.equal((await decision.proposeGuidedNext(settledPodcast.session, settledPodcast.parent, settledPodcast.turn)).questionId, 'SIGNATURE_IDENTITY');
  assert.equal(requests.length, 7, 'Podcast repair caps at one extraction, two proposals and two pairs of parallel audits.');
  const repairedReview = JSON.parse(requests[5].messages[0].content).context;
  assert.equal(repairedReview.acceptedConversation.length, settledPodcast.session.turns.length, 'Uncited earlier answers still inform repetition and coverage review.');
  assert.equal(repairedReview.citedConversation.length, 0, 'Full history is not silently upgraded to cited evidence.');
  for (const field of ['currentAction', 'currentQuestion', 'currentAnswer', 'followupPermitted'])
    assert.equal(field in repairedReview, false, 'Prepared/reuse review cannot interpret a prior accepted turn as pending routing state.');
  assert.equal(repairedReview.repetitionCheckOnly, undefined, 'Podcast review gets identified turns and kinds without a duplicate lossy transcript.');
  assert.equal(repairedReview.remainingPreparedQuestions, undefined, 'A prepared-target auditor sees only the selected canonical obligation.');
  assert.equal(repairedReview.supportedPendingCoverage, undefined);
  assert.equal(repairedReview.target.id, 'SIGNATURE_IDENTITY');
  assert.equal(repairedReview.supportedTargetCoverage.length, 0, 'Coverage for another future target cannot prime review of the chosen question.');
  const repairedInput = JSON.parse(requests[4].messages[0].content);
  assert.equal(repairedInput.acceptedConversation.length, settledPodcast.session.turns.length);
  assert.equal(repairedInput.repairRequired.rejectedProposal, JSON.stringify(repeatedPodcast));

  const knownDirection = require('./fixtures/podcast-interview-quality.cjs').find(item => item.id === 'concise-rich-answer');
  const directionEvidence = [{ answerId: knownDirection.turn.id, quote: 'The idea was a clear path from shared life to privacy.' }];
  const directionProposal = { kind: 'ask_prepared', questionId: 'DESIGN_DIRECTION', text: 'What was the overall design idea?',
    purpose: 'Ask about the overall idea.', sourceAnswerIds: [knownDirection.turn.id], evidence: directionEvidence };
  const assessedDirection = { requestedInformation: 'The overall design idea.', evidence: directionEvidence,
    coverage: 'complete', remainingGap: '', valid: true, reason: 'A prepared target is eligible.' };
  const directionHistory = decision.guidedDecisionContext(knownDirection.session, knownDirection.parent, knownDirection.turn).acceptedConversation;
  assert.equal(decision.validatePodcastReview(assessedDirection, directionProposal, directionHistory).valid, false, 'A contradictory approval cannot expose an open re-ask of assessed complete coverage.');
  const directionConsent = { ...directionProposal, kind: 'confirm_coverage', text: 'Was a clear path from shared life to privacy the overall design idea?' };
  assert.equal(decision.validatePodcastReview(assessedDirection, directionConsent, directionHistory).valid, true, 'Exact-source reuse consent intentionally confirms known information.');
  assert.throws(() => decision.validatePodcastReview({ ...assessedDirection, assertedPremises: [] }, directionConsent, directionHistory), /assertedPremises/);
  assert.throws(() => decision.validatePodcastReview({ ...assessedDirection, unsupportedPremises: ['Moving the walls achieved the design idea; the answer only states these as adjacent facts.'] }, directionConsent, directionHistory), /unsupportedPremises/,
    'The removed early objection field is rejected by the strict schema, never silently ignored to accept a contradictory verdict.');
  assert.equal(decision.validatePodcastReview({ ...assessedDirection, valid: false, reason: 'The question treats the stated privacy goal as the only goal and says that it stopped being the only goal. The answer says the brief changed but never establishes that privacy was its sole original goal.' }, directionConsent, directionHistory).valid, false,
    'A useful bounded explanation must reach repair as a rejection instead of failing schema on an arbitrary short diagnostic limit.');
  assert.equal(decision.validatePodcastReview({ ...assessedDirection, evidence: [{ answerId: knownDirection.turn.id, quote: 'Invented concept.' }] }, directionConsent, directionHistory).valid, false);
  assert.equal(decision.validatePodcastReview({ ...assessedDirection, evidence: [{ answerId: 'unavailable-answer', quote: directionEvidence[0].quote }] }, directionConsent, directionHistory).valid, false);
  assert.equal(decision.validatePodcastReview(assessedDirection, { ...directionConsent, evidence: [{ answerId: knownDirection.turn.id, quote: 'We kept the footprint and moved two internal walls.' }] }, directionHistory).valid, false, 'A confirmation assessment cannot borrow facts outside its proposed reuse passage.');
  assert.equal(decision.validatePodcastReview({ ...assessedDirection, coverage: 'partial', remainingGap: 'Unstated execution detail.' }, directionConsent, directionHistory).valid, false);
  assert.throws(() => decision.validatePodcastReview(goodReview, directionConsent, directionHistory), /requestedInformation/);
  const [conditionalConstraint, assertedConstraint] = require('./fixtures/podcast-premise-repair-quality.json');
  responses = [podcastReview]; factualResponses = [goodFacts]; requests = [];
  await decision.reviewGuidedContent(conditionalConstraint.candidate, conditionalConstraint.context, 'synthetic');
  const directTargetContext = JSON.parse(requests[0].messages[0].content).context;
  for (const field of ['currentAction', 'currentQuestion', 'currentAnswer', 'followupPermitted'])
    assert.equal(field in directTargetContext, false, 'Direct calibration and production calls share target-context pruning at the review boundary.');
  assert.equal(directTargetContext.target.id, conditionalConstraint.candidate.questionId);
  assert.equal(directTargetContext.acceptedConversation.length, conditionalConstraint.context.acceptedConversation.length);
  responses = [podcastReview]; factualResponses = [goodFacts]; requests = [];
  await decision.reviewGuidedContent(podcastReply, { ...podcastFollowupContext, currentAction: 'confirmation',
    target: conditionalConstraint.context.target, supportedTargetCoverage: [{ questionId: 'unrelated' }] }, 'synthetic');
  const directFollowupContext = JSON.parse(requests[0].messages[0].content).context;
  assert.equal(directFollowupContext.currentQuestion.text, podcast.parent.text);
  assert.equal(directFollowupContext.currentAnswer.id, podcast.turn.id);
  assert.equal(directFollowupContext.followupPermitted, podcastFollowupContext.followupPermitted);
  for (const field of ['currentAction', 'target', 'supportedTargetCoverage']) assert.equal(field in directFollowupContext, false);
  factualResponses = [goodFacts]; requests = [];
  assert.equal((await decision.reviewPodcastFacts(conditionalConstraint.candidate, [], 'synthetic')).valid, true);
  factualResponses = [{ valid: false, reason: 'The kept footprint is treated as an unchangeable constraint.' }];
  assert.equal((await decision.reviewPodcastFacts(assertedConstraint.candidate, [], 'synthetic')).valid, false,
    'A grounded conditional inquiry may pass; a final rejection of an asserted constraint remains rejected.');
  assert.equal(requests.length, 2, 'The distinction adds no model call or fallback exemption.');
  responses = [podcastReview]; factualResponses = [{ valid: false, reason: 'The question invents a causal premise.' }]; requests = [];
  const rejectedFacts = await decision.reviewGuidedContent(podcastReply, { ...podcastFollowupContext, conversationStyle: 'podcast' }, 'synthetic');
  assert.equal(rejectedFacts.valid, false, 'A conversation-fit approval cannot bypass a failed factual audit.');
  assert.match(rejectedFacts.reason, /causal premise/);
  responses = [{ ...podcastReview, valid: false, reason: 'The requested consequence is already answered.' }]; factualResponses = [goodFacts]; requests = [];
  const rejectedConversation = await decision.reviewGuidedContent(podcastReply, { ...podcastFollowupContext, conversationStyle: 'podcast' }, 'synthetic');
  assert.equal(rejectedConversation.valid, false, 'A factual approval cannot bypass a failed conversation-fit audit.');
  assert.match(rejectedConversation.reason, /already answered/);
  for (const failedFacts of [new Error('factual audit outage'), { valid: true }, { reason: 'Malformed response.', valid: true, extra: 'unexpected' }]) {
    responses = [podcastReview]; factualResponses = [failedFacts]; requests = [];
    await assert.rejects(decision.reviewGuidedContent(podcastReply, { ...podcastFollowupContext, conversationStyle: 'podcast' }, 'synthetic'));
    assert.equal(requests.length, 2, 'Factual provider/schema errors fail closed at the shared content-review boundary.');
  }
  requests = [];
  assert.equal((await decision.reviewPodcastFacts({ kind: 'advance' }, [], 'synthetic')).valid, true);
  assert.equal(requests.length, 0, 'An advance has no spoken factual premises to send to a model.');
  responses = [{ ...podcastReview, coverage: 'not_applicable', remainingGap: '' }]; requests = [];
  await decision.reviewGuidedContent({ kind: 'advance' }, { conversationStyle: 'podcast',
    remainingPreparedQuestionCount: 0, currentAction: 'answer' }, 'synthetic');
  const advanceReviewContext = JSON.parse(requests[0].messages[0].content).context;
  assert.equal(advanceReviewContext.remainingPreparedQuestionCount, 0, 'Advance preserves the exact count field emitted by decisionReviewContext.');
  assert.equal('currentAction' in advanceReviewContext, false);
  assert.equal(requests.length, 1, 'Advance retains its conversation audit without a factual call.');
  const olderDirection = structuredClone(knownDirection);
  olderDirection.session.turns[0].text += ' The idea was a clear path from shared life to privacy.';
  olderDirection.session.turns[1].text = 'We kept the footprint and moved two internal walls.';
  olderDirection.turn = olderDirection.session.turns[1];
  const olderContext = decision.guidedDecisionContext(olderDirection.session, olderDirection.parent, olderDirection.turn);
  const olderEvidence = [{ answerId: olderDirection.session.turns[0].id, quote: directionEvidence[0].quote }];
  assert.equal(decision.validatePodcastReview({ ...assessedDirection, evidence: olderEvidence }, { ...directionProposal, sourceAnswerIds: [], evidence: [] }, olderContext.acceptedConversation).valid, false,
    'An earlier rich answer can fully cover a future target even when the latest answer contains none of that evidence.');
  const olderConsent = { ...directionConsent, sourceAnswerIds: [olderEvidence[0].answerId], evidence: olderEvidence };
  assert.equal(decision.validatePodcastReview({ ...assessedDirection, evidence: olderEvidence }, olderConsent, olderContext.acceptedConversation).valid, true);

  const coveredDirection = { covered: [{ questionId: 'DESIGN_DIRECTION', ...directionEvidence[0] }] };
  const beforeCoverage = JSON.stringify(knownDirection.session);
  responses = [directionProposal, coveredDirection, directionConsent, assessedDirection]; requests = [];
  assert.equal((await decision.proposeGuidedNext(knownDirection.session, knownDirection.parent, knownDirection.turn)).kind, 'confirm_coverage');
  assert.equal(requests.length, 5, 'A fully covered prepared target is vetoed before paying for either wording audit.');
  assert.equal(requests.filter(request => request.system === coverage.PODCAST_COVERAGE_PROMPT).length, 1, 'Repair reuses the one independent coverage result.');
  const guardedRepair = JSON.parse(requests[2].messages[0].content);
  assert.match(guardedRepair.repairRequired.issue, /already fully answered/);
  const repairProperties = requests[2].output_config.format.schema.properties;
  assert.equal(repairProperties.kind.enum.join(','), 'confirm_coverage,followup,clarification');
  assert.equal(repairProperties.questionId.enum.join(','), 'DESIGN_DIRECTION');
  assert.ok(requests[0].output_config.format.schema.properties.kind.enum.includes('ask_prepared'), 'Initial selection keeps its ordinary choices.');
  assert.equal(guardedRepair.remainingPreparedQuestions.map(question => question.id).join(','), 'DESIGN_DIRECTION');
  assert.match(guardedRepair.repairRequired.availableMoves, /ask_prepared and advance are unavailable/);
  const consentOnlyGrammar = decisionSchemas.guidedDecisionOutputSchema(['DESIGN_DIRECTION'], false, false);
  assert.equal(consentOnlyGrammar.safeParse(directionConsent).success, true);
  assert.equal(consentOnlyGrammar.safeParse({ ...directionConsent, kind: 'followup' }).success, false, 'Exhausted followups cannot be reopened by a repair.');
  assert.equal(consentOnlyGrammar.safeParse({ kind: 'advance' }).success, false);
  assert.equal(JSON.stringify(guardedRepair.supportedPendingCoverage.covered), JSON.stringify(coveredDirection.covered));
  const directionReviewContext = JSON.parse(requests[3].messages[0].content).context;
  assert.equal(JSON.stringify(directionReviewContext.supportedTargetCoverage), JSON.stringify(coveredDirection.covered));
  assert.equal(directionReviewContext.target.id, 'DESIGN_DIRECTION');
  const originalDirectionTarget = knownDirection.session.plan.find(question => question.id === 'DESIGN_DIRECTION');
  assert.equal(directionReviewContext.target.text, originalDirectionTarget.baselineText ?? originalDirectionTarget.text);
  assert.equal(directionReviewContext.remainingPreparedQuestions, undefined);
  assert.equal(JSON.stringify(knownDirection.session), beforeCoverage, 'Supported coverage cannot mutate the plan, answers or accepted evidence.');
  const coverageInput = JSON.parse(requests[1].messages[0].content);
  assert.equal(Object.keys(coverageInput).join(','), 'acceptedAnswers,pendingTargets');
  assert.ok(coverageInput.acceptedAnswers.every(answer => Object.keys(answer).join(',') === 'id,text,roomId'), 'Coverage never sees original collection questions, categories, proposed wording or rationale.');
  assert.ok(coverageInput.pendingTargets.every(target => Object.keys(target).join(',') === 'id,question,roomId'));
  const originalProof = JSON.parse(fs.readFileSync('docs/reviews/project-guide/coverage-extraction-evaluation.json', 'utf8'));
  assert.equal(coverage.PODCAST_COVERAGE_PROMPT, originalProof.system, 'Integration retains the actual evaluated extraction prompt verbatim.');
  const adaptedTarget = structuredClone(knownDirection.session);
  adaptedTarget.plan.find(question => question.id === 'DESIGN_DIRECTION').text = 'How did that idea shape the bedroom?';
  adaptedTarget.plan.find(question => question.id === 'DESIGN_DIRECTION').baselineText = 'What was the overall design idea for this project?';
  assert.equal(coverage.podcastCoverageContext(adaptedTarget).pendingTargets.find(target => target.id === 'DESIGN_DIRECTION').question,
    'What was the overall design idea for this project?', 'Classify the canonical obligation, never an earlier adapted question.');
  responses = [directionConsent, coveredDirection, assessedDirection]; requests = [];
  await decision.proposeGuidedNext(adaptedTarget, knownDirection.parent, knownDirection.turn);
  assert.equal(JSON.parse(requests[2].messages[0].content).context.target.text, 'What was the overall design idea for this project?',
    'The selected review target also uses canonical meaning, never the earlier adapted wording.');
  const correctedCoverage = structuredClone(knownDirection.session);
  correctedCoverage.turns[1].supersededBy = 'corrected-direction';
  correctedCoverage.turns.push({ ...correctedCoverage.turns[1], id: 'corrected-direction', kind: 'correction',
    text: 'The idea was privacy at the edge and shared life in the middle.', supersedes: correctedCoverage.turns[1].id, supersededBy: undefined });
  correctedCoverage.turns.push({ ...correctedCoverage.turns[0], id: 'reuse-consent', kind: 'confirmation' });
  correctedCoverage.turns.push({ ...correctedCoverage.turns[0], id: 'intentional-skip', kind: 'skip' });
  const correctedInput = coverage.podcastCoverageContext(correctedCoverage);
  assert.equal(correctedInput.acceptedAnswers.some(answer => ['concise-scope', 'reuse-consent', 'intentional-skip'].includes(answer.id)), false);
  assert.ok(correctedInput.acceptedAnswers.some(answer => answer.id === 'corrected-direction'));
  assert.throws(() => coverage.validatePodcastCoverage(coveredDirection, correctedInput), /Invalid/);
  const correctedPassage = { questionId: 'DESIGN_DIRECTION', answerId: 'corrected-direction', quote: correctedCoverage.turns[2].text };
  assert.equal(coverage.validatePodcastCoverage({ covered: [correctedPassage] }, correctedInput)[0].answerId, 'corrected-direction');
  assert.throws(() => coverage.validatePodcastCoverage({ covered: [correctedPassage, correctedPassage] }, correctedInput), /Duplicate/);
  assert.throws(() => coverage.validatePodcastCoverage({ covered: [{ ...correctedPassage, quote: 'The idea was invented.' }] }, correctedInput), /exact/);
  const whitespaceInput = structuredClone(correctedInput);
  whitespaceInput.acceptedAnswers.find(answer => answer.id === correctedPassage.answerId).text += '   ';
  assert.throws(() => coverage.validatePodcastCoverage({ covered: [{ ...correctedPassage, quote: '   ' }] }, whitespaceInput), /exact/);
  assert.throws(() => coverage.validatePodcastCoverage({ covered: [{ ...correctedPassage, questionId: 'SCOPE_PARAMETERS' }] }, correctedInput), /Invalid/);
  const scopedCoverage = { acceptedAnswers: [{ id: 'room-answer', text: 'We wanted a quiet place to read.', roomId: 'r1' }],
    pendingTargets: [{ id: 'room-intent', question: 'What should this room make possible?', roomId: 'r2' }] };
  const roomPassage = { questionId: 'room-intent', answerId: 'room-answer', quote: 'We wanted a quiet place to read.' };
  assert.throws(() => coverage.validatePodcastCoverage({ covered: [roomPassage] }, scopedCoverage), /room scope/);
  scopedCoverage.pendingTargets[0].roomId = null;
  assert.throws(() => coverage.validatePodcastCoverage({ covered: [roomPassage] }, scopedCoverage), /room scope/);
  scopedCoverage.pendingTargets[0].roomId = 'r1';
  assert.equal(coverage.validatePodcastCoverage({ covered: [roomPassage] }, scopedCoverage).length, 1);
  scopedCoverage.acceptedAnswers[0].roomId = null;
  assert.equal(coverage.validatePodcastCoverage({ covered: [roomPassage] }, scopedCoverage).length, 1, 'Project evidence may inform the same room target.');

  const newApplication = { kind: 'followup', text: 'How did that clear path shape daily life in the rooms?',
    purpose: 'Follow a new application of the known intention.', sourceAnswerIds: [knownDirection.turn.id], evidence: directionEvidence };
  responses = [newApplication, coveredDirection, { ...podcastReview, requestedInformation: 'How the idea affected daily life.', remainingGap: 'The unspoken effect on daily life.' }]; requests = [];
  assert.equal((await decision.proposeGuidedNext(knownDirection.session, knownDirection.parent, knownDirection.turn)).kind, 'followup',
    'A covered backbone target does not prohibit a permitted new application followup.');
  assert.equal(knownDirection.session.plan.find(question => question.id === 'DESIGN_DIRECTION').status, 'pending');
  // Replay the delivered B-trial question: its new consequence was sound, but its
  // prepared-target label was wrong. Repair must preserve the question as followup.
  const mislabeledStory = structuredClone(podcast);
  const richStory = 'The clients wanted more privacy without disconnecting the rooms. We kept the footprint and moved two internal walls. The idea was a clear path from shared life to privacy. Halfway through demolition, we discovered a sealed courtyard behind the kitchen, and that changed the design.';
  mislabeledStory.turn.text = richStory;
  mislabeledStory.session.turns.find(value => value.id === mislabeledStory.turn.id).text = richStory;
  const storyEvidence = [{ answerId: mislabeledStory.turn.id, quote: 'Halfway through demolition, we discovered a sealed courtyard behind the kitchen, and that changed the design.' }];
  const mislabeledConsequence = { kind: 'ask_prepared', questionId: 'SURPRISE_PIVOT',
    text: 'That sealed courtyard behind the kitchen — how did finding it change the design?',
    purpose: 'The consequence of the discovery is still untold.', sourceAnswerIds: [mislabeledStory.turn.id], evidence: storyEvidence };
  const { questionId: unusedTarget, ...repairedConsequence } = { ...mislabeledConsequence, kind: 'followup' };
  assert.equal(unusedTarget, 'SURPRISE_PIVOT');
  responses = [mislabeledConsequence, { covered: [{ questionId: 'SURPRISE_PIVOT', ...storyEvidence[0] }] },
    repairedConsequence, { ...podcastReview, requestedInformation: 'The design consequence of the discovery.', remainingGap: 'How the discovery changed the design.' }]; requests = [];
  const deliveredConsequence = await decision.proposeGuidedNext(mislabeledStory.session, mislabeledStory.parent, mislabeledStory.turn);
  assert.equal(deliveredConsequence.kind, 'followup');
  assert.equal(deliveredConsequence.text, mislabeledConsequence.text);
  assert.equal('questionId' in deliveredConsequence, false);
  assert.equal(requests.length, 5, 'A label mismatch requires model repair and both audits, never a blind automatic relabel.');
  const consequenceRepair = JSON.parse(requests[2].messages[0].content);
  assert.match(consequenceRepair.repairRequired.issue, /action\/target assignment, not necessarily the question wording/);
  assert.match(consequenceRepair.repairRequired.issue, /preserve a genuinely new current-answer question/);
  assert.equal(consequenceRepair.repairRequired.rejectedProposal, JSON.stringify(mislabeledConsequence));
  // The same guard still blocks an actual broad re-ask even if the model repeats it.
  responses = [directionProposal, coveredDirection, directionProposal]; requests = [];
  await assert.rejects(decision.proposeGuidedNext(knownDirection.session, knownDirection.parent, knownDirection.turn), /Invalid (enum value|option)/);
  assert.equal(requests.length, 3, 'Repeated covered-target requests remain rejected before both wording audits.');
  responses = [directionProposal, coveredDirection, { ...directionConsent, questionId: 'SCOPE_PARAMETERS' }]; requests = [];
  await assert.rejects(decision.proposeGuidedNext(knownDirection.session, knownDirection.parent, knownDirection.turn), /questionId/);
  assert.equal(requests.length, 3, 'A repair cannot confirm an ID that independent coverage did not supply.');
  for (const failedCoverage of [new Error('coverage provider outage'), { covered: [{ ...coveredDirection.covered[0], quote: 'A fabricated passage.' }] }, { covered: [{ ...coveredDirection.covered[0], answerId: 'missing-answer' }] }]) {
    responses = [newApplication, failedCoverage]; requests = [];
    await assert.rejects(decision.proposeGuidedNext(knownDirection.session, knownDirection.parent, knownDirection.turn));
    assert.equal(requests.length, 2, 'A failed classifier cannot be bypassed by a valid proposal or another model call.');
  }
  const withoutRawAnswers = structuredClone(knownDirection);
  withoutRawAnswers.session.turns.forEach(turn => { turn.kind = 'confirmation'; });
  withoutRawAnswers.turn = withoutRawAnswers.session.turns[1];
  responses = [neutralReturn, { ...podcastReview, requestedInformation: 'Designer authorship.', remainingGap: 'What is recognizably theirs.' }]; requests = [];
  await decision.proposeGuidedNext(withoutRawAnswers.session, withoutRawAnswers.parent, withoutRawAnswers.turn);
  assert.equal(requests.length, 3, 'No raw answer means no coverage extraction, but spoken wording still gets both audits.');
  const withoutPendingTargets = structuredClone(knownDirection);
  withoutPendingTargets.session.plan = withoutPendingTargets.session.plan.filter(question => question.status === 'answered');
  responses = [newApplication, { ...podcastReview, requestedInformation: 'Daily-life application.', remainingGap: 'The effect on daily life.' }]; requests = [];
  await decision.proposeGuidedNext(withoutPendingTargets.session, withoutPendingTargets.parent, withoutPendingTargets.turn);
  assert.equal(requests.length, 3, 'No pending target means no coverage extraction, but spoken wording still gets both audits.');

  const relationshipSession = structuredClone(knownDirection.session);
  controller.applyDecision(relationshipSession, { ...directionConsent,
    text: 'Would it be fair to say the idea was a clear path from shared life to privacy, achieved by moving those two walls?' });
  const relationshipQuestion = controller.currentQuestion(relationshipSession);
  const confirmedRelationship = controller.acceptCommand(relationshipSession, { action: 'answer', requestId: 'relationship-consent-01',
    sessionId: relationshipSession.id, version: relationshipSession.version, questionId: relationshipQuestion.id, text: 'Yes, exactly.', inputModality: 'voice' });
  assert.equal(confirmedRelationship.turns.at(-1).text, directionEvidence[0].quote, 'Tentative relationship wording cannot be copied into canonical source evidence after confirmation.');
  assert.equal(confirmedRelationship.turns.at(-1).confirmationText, 'Yes, exactly.');

  projectFixture = { id: 'p1', title: 'Synthetic', rooms: [{ id: 'r1', name: 'Living Room', selections: [] }, { id: 'r2', name: 'Living Room', selections: [] }], images: [
    { id: 'photo1', url: 'https://example.invalid/1.jpg', roomId: 'r1', room: 'Living Room', tags: [] },
    { id: 'photo2', url: 'https://example.invalid/2.jpg', roomId: null, room: 'Living Room', tags: [] },
    { id: 'photo3', url: 'https://example.invalid/3.jpg', roomId: null, room: 'r2', tags: [] },
  ] };
  const scoped = await prep.readGuidedContext('p1');
  assert.equal(scoped.rooms[0].imageIds.join(','), 'photo1'); assert.equal(scoped.rooms[1].imageIds.join(','), 'photo3'); assert.equal(scoped.images[1].roomId, null);
  projectFixture.images[0].roomId = 'r2'; assert.notEqual((await prep.readGuidedContext('p1')).contextFingerprint, scoped.contextFingerprint);
  projectFixture.images[0].tags = [{ id: 'tag1', productId: 'product1', finishRaw: 'Walnut', finishConfirmed: true, reviewedAt: null, product: { name: 'Accent table', scrapeStatus: 'PENDING' } }];
  const materialFingerprint = (await prep.readGuidedContext('p1')).contextFingerprint;
  projectFixture.images[0].tags[0].finishRaw = 'Oak';
  const changedFinish = (await prep.readGuidedContext('p1')).contextFingerprint;
  assert.notEqual(changedFinish, materialFingerprint, 'guided prep refreshes after an edited finish');
  projectFixture.images[0].tags[0].reviewedAt = new Date();
  assert.notEqual((await prep.readGuidedContext('p1')).contextFingerprint, changedFinish, 'guided prep refreshes after tag review');
  await assert.rejects(prep.prepareGuidedRoomPlan('p1', { projectId: 'p1', roomsPrepared: false, plan: [{ roomId: null, status: 'active' }] }), /Finish the prepared project section/);
  console.log('Guided prompt checks passed: contextual preparation/review/repair, preserved obligations and evidence, five multi-turn contexts, confirmation, corrections, skip adaptation, room transitions, semantic rejection, bounded retry and provider failure.');
}
run().catch(error => { console.error(error); process.exitCode = 1; });
