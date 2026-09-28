// Sanitized synthetic conversations. No project data or private notes.
const projectQuestions = [
  ['CLIENT_BRIEF', 'What did the clients come to you wanting from this project?'],
  ['SCOPE_PARAMETERS', 'What were you working within on this project?'],
  ['DESIGN_DIRECTION', 'What was the overall design idea for this project?'],
  ['SIGNATURE_IDENTITY', 'What in this project is most recognizably yours?'],
  ['SURPRISE_PIVOT', 'What discovery changed the direction of this project along the way?'],
];
const q = (id, text, category, roomId = null, status = 'pending') => ({ id, text, category, roomId, status, kind: 'prepared', sourceImageIds: [], sourceAnswerIds: [] });
const t = (id, question, text, extra = {}) => ({ id, requestId: `request-${id}`, questionId: question.id, questionText: question.text, text, roomId: question.roomId, kind: 'answer', sourceImageIds: [], selectedImageId: null, inputModality: 'text', createdAt: '2026-09-26T12:00:00.000Z', ...extra });
function fixture(id, expected, plan, turns, currentId, roomsPrepared = false) {
  const turn = turns.find(value => value.id === currentId);
  return { id, expected, parent: plan.find(value => value.id === turn.questionId), turn,
    session: { id: `session-${id}`, schemaVersion: 1, projectId: 'synthetic-only', version: 4, status: 'deciding', phase: turn.roomId ? 'rooms' : 'project',
      plan, turns, rooms: [{ id: 'living', name: 'Living Room', imageIds: [], baseQuestions: 3, maxFollowUps: 1 }, { id: 'kitchen', name: 'Kitchen', imageIds: [], baseQuestions: 3, maxFollowUps: 1 }],
      activeQuestionId: turn.questionId, roomsPrepared, pendingDecisionTurnId: turn.id, contextFingerprint: 'synthetic', minimumTotalAnswers: 8, requestIds: [], notice: null,
      createdAt: '2026-09-26T12:00:00.000Z', updatedAt: '2026-09-26T12:00:00.000Z' } };
}
const projectPlan = () => projectQuestions.map(([category, text]) => q(category, text, category));
const broad = projectPlan(); broad[0].status = 'answered';
const broadAnswer = t('broad-answer', broad[0], 'The clients are old friends who moved from New York to Miami. They wanted to keep the bones of the house but redesign every space. The exterior should stay quiet; inside, they wanted it to feel personal and show their personalities.');
const follow = q('brief-follow', 'What about their personalities did you want the interior to express?', 'CLIENT_BRIEF', null, 'answered');
follow.kind = 'followup'; follow.parentQuestionId = broad[0].id; follow.parentAnswerId = broadAnswer.id;
const broadFollow = t('broad-follow-answer', follow, 'They are playful collectors, but they also wanted a home that feels relaxed when it is just the two of them.');
const concise = projectPlan(); concise.slice(0, 2).forEach(value => { value.status = 'answered'; });
const corrected = projectPlan(); corrected[0].status = 'answered';
const old = t('outdated-client', corrected[0], 'The clients moved from New York and wanted a holiday home.', { supersededBy: 'corrected-client' });
const roomPlan = [q('living-intent', 'What did you want the Living Room to make possible?', 'room_intent', 'living', 'answered'), q('living-layout', 'What shaped the layout of the Living Room?', 'room_layout', 'living', 'answered'), q('kitchen-intent', 'What did you want the Kitchen to make possible?', 'room_intent', 'kitchen'), q('kitchen-use', 'How did you want the Kitchen to support daily life?', 'room_use', 'kitchen')];
const productPlan = [q('product-client', projectQuestions[0][1], 'CLIENT_BRIEF', null, 'answered'), q('living-whole', 'What did you want this room to feel like?', 'room_atmosphere', 'living', 'answered'), q('living-use', 'How did you want this room to support daily life?', 'room_use', 'living'), q('living-flow', 'What shaped the layout of this room?', 'room_layout', 'living')];
module.exports = [
  fixture('friends-new-york-miami', 'After the useful personality follow-up, acknowledge the answer only if useful and confirm already stated scope, or ask a remaining scope detail. Do not ask the full generic scope or direction again.', [broad[0], follow, ...broad.slice(1)], [broadAnswer, broadFollow], broadFollow.id),
  fixture('concise-rich-answer', 'Treat two concise factual answers as useful evidence. Adapt design-direction or confirm it; do not demand a generic example or repeat the full brief/scope.', concise, [t('concise-brief', concise[0], 'A family of four wanted separate quiet and social areas without adding any floor area.'), t('concise-scope', concise[1], 'We kept the footprint and moved two internal walls. The idea was a clear path from shared life to privacy.')], 'concise-scope'),
  fixture('correction', 'Use corrected permanent-home purpose and disregard superseded holiday-home premise. Continue with a scope question grounded in the corrected brief, without inventing remaining work.', corrected, [old, t('corrected-client', corrected[0], 'Correction: they did not move from New York, and this is their permanent home. They wanted more privacy without making the rooms feel disconnected.', { kind: 'correction', supersedes: old.id })], 'corrected-client'),
  fixture('room-progression', 'Close the Living Room naturally and ask a kitchen-level question. Do not import a living-room spatial choice into the Kitchen as fact.', roomPlan, [t('living-1', roomPlan[0], 'A place to read together in the evenings without shutting out the rest of the family.'), t('living-2', roomPlan[1], 'We kept the middle open so people can cross the room without interrupting someone reading.')], 'living-2', true),
  fixture('unselected-product', 'Do not ask about the volunteered lamp or its designer, placement, effect or descriptor. Use accepted family routine to ask the remaining room-wide use/layout gap.', productPlan, [t('product-brief', productPlan[0], 'The family wanted somewhere to gather after school, and enough room to spread out with homework.'), t('lamp-answer', productPlan[1], 'Warm and relaxed. The red vintage floor lamp is my favorite part; I found it at a market.')], 'lamp-answer', true),
];
