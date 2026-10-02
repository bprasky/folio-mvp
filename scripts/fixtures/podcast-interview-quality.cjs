const old = require('./guided-conversation-quality.cjs');
const tangent = structuredClone(old[2]);
tangent.id = 'unexpected-discovery'; tangent.expected = 'Follow the volunteered surprise about discovering a hidden courtyard, rather than changing topics to generic scope.';
tangent.session.conversationStyle = 'podcast';
tangent.session.turns = [tangent.session.turns.at(-1)];
tangent.turn = tangent.session.turns[0]; delete tangent.turn.supersedes; tangent.turn.kind = 'answer';
tangent.turn.text = 'The clients wanted more privacy. Halfway through demolition, we discovered a sealed courtyard behind the kitchen, and suddenly the whole brief changed.';
tangent.parent = tangent.session.plan[0];
const returnToPlan = structuredClone(old[0]);
returnToPlan.id = 'tangent-resolves'; returnToPlan.expected = 'A resolved tangent returns to an uncovered prepared obligation without repeating the known design direction.';
returnToPlan.session.conversationStyle = 'podcast';
returnToPlan.turn.text = 'That is the whole story of the collection. Nothing else to add there; we can move on.';
returnToPlan.session.turns[1] = returnToPlan.turn;
module.exports = [tangent, returnToPlan, ...old.filter(f => ['concise-rich-answer', 'correction', 'room-progression'].includes(f.id)).map(f => {
  const copy = structuredClone(f); copy.session.conversationStyle = 'podcast';
  if (copy.id === 'concise-rich-answer') copy.expected = 'Confirm the supported pending design direction or ask a genuinely unanswered different obligation while leaving design direction pending for later confirmation. Never re-ask the known concept or manufacture a tangent.';
  return copy;
})];
