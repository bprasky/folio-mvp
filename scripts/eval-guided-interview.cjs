// Synthetic, text-only before/after eval. No project reads or database writes.
// The old side uses the live single-follow-up system prompt; the new side uses
// the guided decision request. Run --live --before before editing the new prompt.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { load } = require('./lib/load-story-activity.cjs');
const fixtures = require('./fixtures/guided-interview-evaluation.json');
const destination = path.resolve('.tmp/guided-interview-prompt-eval.json');
if (!process.argv.includes('--live')) { console.log('Use --live --before or --live --after for five bounded synthetic provider calls.'); process.exit(0); }
require('dotenv').config({ path: '.env.local', quiet: true });
require('dotenv').config({ path: '.env', quiet: true });
const Anthropic = require('@anthropic-ai/sdk').default;
const { MODELS } = load('src/lib/ai/models.ts');
const persona = load('src/lib/interview/prompts/persona.ts');
const rules = load('src/lib/interview/prompts/rules.ts');
const { digestInterviewAnswer } = load('src/lib/interview/digestInterviewAnswer.ts');
const oldSource = fs.readFileSync('src/app/api/posting/project/[projectId]/interview/followups/single/route.ts', 'utf8');
const oldSystemExpression = oldSource.match(/const SYSTEM_PROMPT = (`[\s\S]*?`);/)[1];
const oldSystem = vm.runInNewContext(oldSystemExpression, { ...persona, ...rules });
function oldRequest(fixture) {
  let prompt = `Project: Synthetic pilot fixture\nCurrent room: Living Room\n\nDesigner's answer:\n[question-1]: ${fixture.answer}`;
  prompt += '\n\nGenerate 0-2 follow-up questions that dig deeper into the most interesting aspects of this answer. Reference specific products, rooms, or details from what the designer said. Frame questions to elicit quotable, publishable answers. Keep each under 180 characters.';
  const digest = digestInterviewAnswer(fixture.answer, { roomNames: ['Living Room'] });
  if (digest.isThin) prompt += `\n\nNOTE: The designer's answer was brief (${digest.thinReason}). Generate a warm follow-up that invites them to elaborate with a specific detail. Frame it as "Walk us through..." or "Tell us about the moment when..." rather than repeating the question.`;
  if (digest.hasUnpulledThread && digest.threadHint) prompt += `\n\nNOTE: The designer hinted at a story ("${digest.threadHint.slice(0, 100)}"). Follow up on this specific thread — they started something interesting.`;
  if (digest.richnessScore > .6) prompt += "\n\nNOTE: This answer is already rich and complete. Only generate a follow-up if there's a clear new thread worth pulling. It's fine to return no follow-up.";
  return { model: MODELS.sonnet, thinking: { type: 'disabled' }, max_tokens: 768, system: oldSystem, messages: [{ role: 'user', content: prompt }] };
}
async function main() {
  const side = process.argv.includes('--before') ? 'before' : 'after';
  const existing = fs.existsSync(destination) ? JSON.parse(fs.readFileSync(destination, 'utf8')) : {};
  const results = [];
  const client = new Anthropic({ maxRetries: 0, timeout: 30000 });
  const guided = side === 'after' ? load('src/lib/interview/guided/decision.ts') : null;
  for (const fixture of fixtures) {
    const question = { id: 'question-1', text: fixture.question, category: 'room_intent', roomId: 'room-1', kind: 'prepared', status: 'answered', sourceImageIds: [], sourceAnswerIds: [] };
    const turn = { id: 'turn-1', questionId: question.id, text: fixture.answer, kind: fixture.kind || 'answer', roomId: 'room-1' };
    const session = { projectId: 'synthetic', plan: [question], turns: [turn], rooms: [{ id: 'room-1', name: 'Living Room', maxFollowUps: 1 }], activeQuestionId: question.id };
    try {
      const request = side === 'before' ? oldRequest(fixture) : guided.buildGuidedDecisionRequest(session, question, turn);
      const result = await client.messages.create(request);
      const output = result.content.filter(block => block.type === 'text').map(block => block.text).join('');
      const committed = guided ? guided.validateGuidedDecision(output, session, question, turn) : null;
      results.push({ fixture: fixture.id, expected: fixture.expected, model: result.model, inputTokens: result.usage.input_tokens, outputTokens: result.usage.output_tokens, output, committed });
      console.log(fixture.id, result.usage.input_tokens, result.usage.output_tokens, committed ? JSON.stringify(committed) : output);
    } catch (error) { results.push({ fixture: fixture.id, error: error.message }); console.log(fixture.id, 'FAILED', error.message); process.exitCode = 1; }
  }
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, JSON.stringify({ ...existing, [side]: results }, null, 2));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
