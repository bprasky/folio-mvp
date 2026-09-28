import assert from 'node:assert/strict';
import { acceptCommand, acceptedTurns, appendRoomPlan, applyDecision, canonicalGuidedAnswers, completionState, createGuidedSession, currentQuestion, followUpAllowed, GuidedConflict, projectPhaseComplete } from '../src/lib/interview/guided/controller';
import { PROJECT_CATEGORIES, type GuidedCommand, type GuidedPreparation, type GuidedQuestion, type GuidedSession } from '../src/lib/interview/guided/types';

const preparation: GuidedPreparation = {
  rooms: [{ id: 'room-a', name: 'Living room', imageIds: ['photo-a'], baseQuestions: 3, maxFollowUps: 1 }, { id: 'room-b', name: 'Kitchen', imageIds: ['photo-b'], baseQuestions: 3, maxFollowUps: 1 }],
  contextFingerprint: 'fixture', minimumTotalAnswers: 8,
  questions: PROJECT_CATEGORIES.map(category => ({ id: `q-${category}`, text: 'What shaped your approach to this project?', category, roomId: null, sourceImageIds: ['photo-a'], sourceAnswerIds: [], status: 'pending', kind: 'prepared' })),
};
let requests = 0;
const command = (session: GuidedSession, fields: Partial<GuidedCommand>): GuidedCommand => ({ action: 'answer', requestId: `request-${++requests}`, version: session.version, questionId: session.activeQuestionId ?? undefined, text: 'The open plan supports the daily routines of the whole family.', ...fields });
const initial = () => createGuidedSession('project-a', structuredClone(preparation), 'start-0001');
const roomPlan = (session: GuidedSession): GuidedQuestion[] => session.rooms.flatMap(room => Array.from({ length: room.baseQuestions }, (_, index) => ({ id: `${room.id}-q-${index}`, text: 'What shaped the layout of this room?', category: 'room_layout', roomId: room.id, sourceImageIds: room.imageIds, sourceAnswerIds: acceptedTurns(session).map(t => t.id), status: 'pending', kind: 'prepared' })));

let s = initial();
const ids = s.plan.map(q => q.id);
const send = command(s, {});
s = acceptCommand(s, send);
assert.equal(s.status, 'deciding');
assert.equal(canonicalGuidedAnswers(s).length, 1, 'accepted evidence exists before a next-question decision');
assert.equal(s.turns[0].questionText, preparation.questions[0].text);
assert.equal(acceptCommand(s, send), s, 'same request ID cannot duplicate a saved answer');
assert.throws(() => acceptCommand(s, { ...send, text: 'Different text must not be reported as saved.' }), (error: unknown) => error instanceof GuidedConflict && error.code === 'REQUEST_ID_REUSED');
assert.throws(() => acceptCommand(s, { ...send, action: 'pause' }), /different content/);
assert.throws(() => acceptCommand(s, { ...send, requestId: 'stale-0001' }), (error: unknown) => error instanceof GuidedConflict && error.code === 'STALE_VERSION');
assert.equal(canonicalGuidedAnswers(s)[0].linkedImageId, null, 'browsing or a source image is not an explicit answer attachment');

const parent = s.plan[0];
applyDecision(s, { kind: 'followup', text: 'What mattered most in that decision?', purpose: 'Explain the stated overall project decision.', sourceAnswerIds: [s.turns[0].id] });
assert.equal(s.plan.filter(q => q.kind === 'prepared').length, 5);
assert.deepEqual(s.plan.filter(q => q.kind === 'prepared').map(q => q.id), ids, 'adaptation must preserve every prepared obligation');
const followup = currentQuestion(s)!;
assert.equal(followup.parentQuestionId, parent.id);
assert.equal(followup.parentAnswerId, s.turns[0].id);
assert.equal(followUpAllowed(s, parent), false, 'one immediate follow-up per prepared question');
s = acceptCommand(s, command(s, { text: 'We arranged shared daily activities around the common space.' }));
assert.equal(canonicalGuidedAnswers(s).find(a => a.isFollowUp)?.parentQuestionId, parent.id);
applyDecision(s, { kind: 'followup', text: 'What else?', purpose: 'More detail', sourceAnswerIds: [s.turns[1].id] });
assert.equal(s.plan.filter(q => q.kind !== 'prepared').length, 1, 'a follow-up cannot create an endless chain');

const originalText = s.turns[0].text;
s = acceptCommand(s, command(s, { action: 'correct', questionId: parent.id, text: 'Correction: the clients wanted a quiet place for two people.' }));
assert.equal(s.turns[0].text, originalText, 'correction must preserve original exchange');
assert.ok(s.turns[0].supersededBy);
assert.equal(s.plan.find(q => q.id === followup.id)?.status, 'invalidated');
assert.equal(canonicalGuidedAnswers(s).length, 1, 'a superseded premise cannot retain dependent accepted follow-up evidence');
assert.match(canonicalGuidedAnswers(s)[0].answer, /^Correction/);
applyDecision(s, { kind: 'advance' });

assert.throws(() => acceptCommand(s, command(s, { text: 'x'.repeat(2001) })), /2,000|2000/);
assert.throws(() => acceptCommand(s, command(s, { text: '    ' })), /characters/);
assert.throws(() => acceptCommand(s, command(s, { selectedImageId: 'outside-project-photo' })), /photograph/);
const projectPhoto = acceptCommand(s, command(s, { selectedImageId: 'photo-b' }));
assert.equal(projectPhoto.turns.at(-1)?.selectedImageId, 'photo-b', 'a project question may explicitly attach any authoritative project photo');
const spaced = '  This original text retains its surrounding spaces in history.  ';
const withSpaces = acceptCommand(s, command(s, { text: spaced }));
assert.equal(withSpaces.turns.at(-1)?.text, spaced, 'raw original input is retained even though canonical schema trims it');

assert.throws(() => acceptCommand(initial(), command(initial(), { action: 'finish', confirmPartial: true })), /at least one/);
assert.throws(() => acceptCommand(s, command(s, { action: 'finish' })), /confirm/);
const partial = acceptCommand(s, command(s, { action: 'finish', confirmPartial: true }));
assert.equal(partial.status, 'finished');
assert.ok(partial.plan.some(q => q.status === 'pending'), 'partial finish does not invent coverage or remove pending obligations');
assert.match(partial.notice!, /shorter/);
const resumed = acceptCommand(partial, command(partial, { action: 'resume' }));
assert.equal(resumed.activeQuestionId, s.activeQuestionId);

let complete = initial();
for (let i = 0; i < 5; i++) {
  complete = acceptCommand(complete, command(complete, { action: i === 4 ? 'skip' : 'answer' }));
  if (complete.status === 'deciding') applyDecision(complete, { kind: 'advance' });
}
assert.equal(projectPhaseComplete(complete), true);
assert.equal(complete.plan.at(-1)?.status, 'skipped', 'intentional skip is separate from coverage');
assert.throws(() => appendRoomPlan(structuredClone(complete), roomPlan(complete).slice(0, 5)), /incomplete/);
appendRoomPlan(complete, roomPlan(complete));
assert.equal(complete.plan.filter(q => q.roomId !== null).length, 6);
assert.equal(currentQuestion(complete)?.roomId, 'room-a');
assert.throws(() => acceptCommand(complete, command(complete, { selectedImageId: 'photo-b' })), /photograph/, 'a room question cannot be attributed to another room');
assert.throws(() => acceptCommand(initial(), command(initial(), { action: 'section', roomId: 'room-b' })), /preparing/, 'room navigation cannot prepare rooms prematurely');
let navigation = acceptCommand(complete, command(complete, { text: 'We opened the plan around daily movement.' }));
applyDecision(navigation, { kind: 'advance' });
const unfinished = navigation.activeQuestionId;
navigation = acceptCommand(navigation, command(navigation, { action: 'section', roomId: 'room-b' }));
assert.equal(currentQuestion(navigation)?.roomId, 'room-b');
assert.equal(navigation.plan.find(q => q.id === unfinished)?.status, 'pending', 'changing section must preserve the former active obligation');
const skipRoom = command(navigation, { action: 'skip_room', roomId: 'room-b' });
navigation = acceptCommand(navigation, skipRoom);
assert.equal(navigation.plan.filter(q => q.roomId === 'room-b' && q.status === 'skipped').length, 3);
assert.equal(navigation.turns.filter(t => t.requestId === skipRoom.requestId && t.kind === 'skip').length, 3);
assert.equal(acceptCommand(navigation, skipRoom), navigation, 'retrying a room skip must not duplicate skip turns');
applyDecision(navigation, { kind: 'advance' });
assert.equal(navigation.activeQuestionId, unfinished);
navigation = acceptCommand(navigation, command(navigation, { action: 'skip_room' }));
applyDecision(navigation, { kind: 'advance' });
assert.equal(navigation.plan.find(q => q.id === 'room-a-q-0')?.status, 'answered', 'room skip retains already accepted room answers');
assert.equal(canonicalGuidedAnswers(navigation).filter(a => a.roomId === 'room-a').length, 1);
for (let i = 0; i < 6; i++) {
  complete = acceptCommand(complete, command(complete, { selectedImageId: currentQuestion(complete)!.roomId === 'room-a' ? 'photo-a' : 'photo-b' }));
  applyDecision(complete, { kind: 'advance' });
}
assert.equal(completionState(complete).complete, true);
assert.equal(complete.status, 'ready');
assert.equal(canonicalGuidedAnswers(complete).length, 10);
assert.equal(complete.plan.filter(q => q.status === 'skipped').length, 1);
assert.equal(acceptCommand(complete, command(complete, { action: 'finish' })).status, 'finished');

const pausedPending = acceptCommand(acceptCommand(initial(), command(initial(), {})), command({ ...initial(), version: 2 }, { action: 'pause', version: 2 }));
assert.equal(pausedPending.status, 'paused');
assert.ok(pausedPending.pendingDecisionTurnId, 'pause while deciding preserves accepted turn awaiting a next decision');

// One broad answer can supply several topics, but only the designer can accept
// reuse. The application retains prepared IDs and the original answer verbatim.
const broadText = 'We kept the existing footprint and renovated the shared rooms. The design direction was calm, open rooms for family gatherings.';
let adaptive = acceptCommand(initial(), command(initial(), { text: broadText }));
const broad = adaptive.turns[0], scopeId = adaptive.plan[1].id, designId = adaptive.plan[2].id;
const scopeBaseline = adaptive.plan[1].text;
const reaction = 'The existing footprint gives the renovation a clear boundary.';
const scopeWording = 'What timing shaped the renovation within the existing footprint?';
applyDecision(adaptive, { kind: 'ask_prepared', questionId: scopeId, text: scopeWording, reaction,
  purpose: 'Clarify the timing, since the extent of the renovation is already supplied.',
  sourceAnswerIds: [broad.id], evidence: [{ answerId: broad.id, quote: 'kept the existing footprint' }] });
assert.equal(currentQuestion(adaptive)?.id, scopeId);
assert.equal(currentQuestion(adaptive)?.text, scopeWording);
assert.equal(currentQuestion(adaptive)?.baselineText, scopeBaseline);
assert.equal(currentQuestion(adaptive)?.reaction, reaction);
assert.deepEqual(adaptive.plan.filter(question => question.kind === 'prepared').map(question => question.id), ids);
assert.equal(canonicalGuidedAnswers(adaptive).length, 1, 'natural wording does not silently satisfy a prepared obligation');
adaptive = acceptCommand(adaptive, command(adaptive, { text: 'We had nine months before the family moved back.' }));
assert.equal(adaptive.turns.at(-1)?.reaction, reaction, 'the reaction stays with the exchange for a faithful resume');
assert.equal(adaptive.turns.at(-1)?.questionText, scopeWording, 'history records the question actually asked');
const designQuote = 'The design direction was calm, open rooms for family gatherings.';
applyDecision(adaptive, { kind: 'confirm_coverage', questionId: designId,
  text: 'Does your earlier description of calm, open rooms capture the design direction?',
  reaction: 'You have already described the direction in your opening answer.',
  purpose: 'Confirm that the supplied design direction covers this prepared topic.',
  sourceAnswerIds: [broad.id], evidence: [{ answerId: broad.id, quote: designQuote }] });
assert.equal(currentQuestion(adaptive)?.status, 'active');
assert.equal(canonicalGuidedAnswers(adaptive).length, 2, 'a proposed confirmation is not accepted evidence');
assert.deepEqual(currentQuestion(adaptive)?.confirmation, { answerId: broad.id, quote: designQuote });
const typedCommand = command(adaptive, { text: '  Yes!  ' });
let typed = acceptCommand(adaptive, typedCommand);
assert.equal(typed.turns.at(-1)?.kind, 'confirmation');
assert.equal(typed.turns.at(-1)?.text, designQuote); assert.equal(typed.turns.at(-1)?.confirmationText, '  Yes!  ');
assert.equal(acceptCommand(typed, typedCommand), typed, 'typed confirmation retries retain the original answer command digest');
assert.throws(() => acceptCommand(typed, { ...typedCommand, action: 'confirm', text: undefined }), /different content/);
const qualification = 'Yes, but the enclosed rooms matter just as much.';
const qualified = acceptCommand(adaptive, command(adaptive, { text: qualification }));
assert.equal(qualified.turns.at(-1)?.kind, 'answer'); assert.equal(qualified.turns.at(-1)?.text, qualification);
assert.equal(acceptCommand(initial(), command(initial(), { text: 'Yes!' })).turns.at(-1)?.kind, 'answer', 'ordinary questions never reinterpret yes as reused evidence');
assert.equal(acceptCommand(adaptive, command(adaptive, { text: 'Yes!', selectedImageId: 'photo-a' })).turns.at(-1)?.kind, 'answer', 'a photo-bearing answer is not silently converted to confirmation');
applyDecision(typed, { kind: 'advance' });
typed = acceptCommand(typed, command(typed, { action: 'correct', questionId: broad.questionId, text: 'The direction changed to enclosed rooms.' }));
assert.ok(!canonicalGuidedAnswers(typed).some(answer => answer.questionId === designId), 'correcting the source reopens a typed confirmation too');
assert.equal(typed.turns.find(turn => turn.requestId === typedCommand.requestId)?.confirmationText, '  Yes!  ', 'literal confirmation input remains in immutable history');
const forgedSource = structuredClone(adaptive);
currentQuestion(forgedSource)!.confirmation!.answerId = 'not-an-accepted-project-answer';
assert.throws(() => acceptCommand(forgedSource, command(forgedSource, { action: 'confirm', text: undefined })), /source|answer|confirm/i);
const confirm = command(adaptive, { action: 'confirm', text: undefined });
adaptive = acceptCommand(adaptive, confirm);
const reused = adaptive.turns.at(-1)!;
assert.equal(reused.kind, 'confirmation'); assert.equal(reused.reusedFromAnswerId, broad.id);
assert.equal(reused.text, designQuote, 'confirmation copies exactly the raw excerpt shown for consent, never an assistant summary');
assert.equal(acceptCommand(adaptive, confirm), adaptive, 'duplicate confirmation cannot duplicate accepted evidence');
assert.equal(canonicalGuidedAnswers(adaptive).find(answer => answer.questionId === designId)?.answer, designQuote);
assert.ok(canonicalGuidedAnswers(adaptive).every(answer => !('reaction' in answer) && !answer.answer.includes(reaction)), 'assistant reactions never enter designer quotations');
const signature = adaptive.plan[3], signatureBaseline = signature.text;
applyDecision(adaptive, { kind: 'ask_prepared', questionId: signature.id, text: 'How did the calm, open rooms express your own approach?',
  purpose: 'Ask how the supplied overall direction relates to the designer’s identity.', sourceAnswerIds: [broad.id], evidence: [{ answerId: broad.id, quote: 'calm, open rooms' }] });
const correctedAdaptive = acceptCommand(adaptive, command(adaptive, { action: 'correct', questionId: broad.questionId, text: 'Correction: we extended the footprint and designed a sequence of enclosed rooms.' }));
assert.equal(correctedAdaptive.turns.find(turn => turn.id === broad.id)?.text, broadText);
assert.equal(correctedAdaptive.turns.find(turn => turn.id === reused.id)?.text, designQuote);
assert.ok(!acceptedTurns(correctedAdaptive).some(turn => turn.id === reused.id), 'a correction invalidates previously confirmed reuse of the replaced answer');
assert.ok(['pending', 'active'].includes(correctedAdaptive.plan.find(question => question.id === designId)!.status), 'the confirmed obligation is reopened rather than erased');
assert.ok(!canonicalGuidedAnswers(correctedAdaptive).some(answer => answer.questionId === designId));
const resetSignature = correctedAdaptive.plan.find(question => question.id === signature.id)!;
assert.equal(resetSignature.text, signatureBaseline, 'a pending question cannot keep wording grounded in corrected-away evidence');
assert.equal(resetSignature.adaptation, undefined);
assert.ok(!acceptedTurns(correctedAdaptive).some(turn => turn.questionId === scopeId), 'an answered adaptation also loses its invalid premise');

// Dependency invalidation must follow answer -> adapted answer -> adapted answer,
// while ordinary preparation context does not itself make an accepted answer dependent.
let chain = acceptCommand(initial(), command(initial(), { text: broadText }));
const chainA = chain.turns[0];
applyDecision(chain, { kind: 'ask_prepared', questionId: scopeId, text: scopeWording, purpose: 'Ask the remaining timing constraint.',
  sourceAnswerIds: [chainA.id], evidence: [{ answerId: chainA.id, quote: 'kept the existing footprint' }] });
chain = acceptCommand(chain, command(chain, { text: 'The nine-month construction schedule shaped our choices.' }));
const chainB = chain.turns.at(-1)!;
applyDecision(chain, { kind: 'ask_prepared', questionId: designId, text: 'How did the nine-month schedule affect the design direction?', purpose: 'Relate the stated schedule to the design.',
  sourceAnswerIds: [chainB.id], evidence: [{ answerId: chainB.id, quote: 'nine-month construction schedule' }] });
chain = acceptCommand(chain, command(chain, { text: 'We limited the material palette so decisions could be made together.' }));
const chainC = chain.turns.at(-1)!;
applyDecision(chain, { kind: 'advance' });
currentQuestion(chain)!.sourceAnswerIds = [chainA.id];
chain = acceptCommand(chain, command(chain, { text: 'The curve of the stair is our signature.' }));
const independent = chain.turns.at(-1)!;
applyDecision(chain, { kind: 'advance' });
chain = acceptCommand(chain, command(chain, { action: 'correct', questionId: chainA.questionId, text: 'Correction: we extended the footprint and had two years.' }));
assert.ok([chainB.id, chainC.id].every(id => !acceptedTurns(chain).some(turn => turn.id === id)), 'transitively grounded accepted answers are invalidated');
assert.ok([scopeId, designId].every(id => chain.plan.find(question => question.id === id)?.status === 'pending'), 'dependent prepared obligations reopen');
assert.ok(acceptedTurns(chain).some(turn => turn.id === independent.id), 'preparation context alone must not invalidate an independent answer');
assert.ok([chainA, chainB, chainC].every(original => chain.turns.find(turn => turn.id === original.id)?.text === original.text), 'invalidated exchanges stay immutable in history');
console.log('PASS grounded prepared adaptation, retained actual wording/reactions, explicit raw-answer confirmation, forged source rejection, duplicate confirmation and correction reopening');
console.log('PASS guided controller: prepared obligations, bounded follow-ups, canonical evidence, revisions, skip/partial finish, length/image scope, duplicate/stale versions and pause/resume');
