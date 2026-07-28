// Editorial Queue — prompt generation (docs/17_EDITORIAL_QUEUE.md, Component 3).
// The second Anthropic call: given the angle, its evidence, and the assigned
// format, generate the specific questions the designer will answer. Prompts are
// stored on the EditorialQueueItem, not generated at render time.
//
// The intelligence lives in the question: each prompt encodes this designer's
// corpus, so it could only be asked of them. Product NAMING inside the eventual
// published piece is governed separately by docs/20_PRODUCT_NAMING_GATE.md; this
// call produces the private interview prompts, which may be specific.

import Anthropic from '@anthropic-ai/sdk';
import { randomUUID } from 'crypto';
import { MODELS } from '@/lib/ai/models';
import { callLLM } from '@/lib/posting/llmClient';
import type { QueueFormat } from './assignFormat';
import type { ExtractedAngle, PromptStructure, QueuePromptItem } from './types';
import { FOLIO_INTERVIEWER_PERSONA } from '@/lib/interview/prompts/persona';
import { SHARED_RULE_BLOCK, ARRIVALS_CONTRAST_POLICY } from '@/lib/interview/prompts/rules';
import { isArrivalSafe } from '@/lib/interview/prompts/validateQuestion';

const PROMPT_GEN_MAX_TOKENS = 1200;
const PROMPT_GEN_TEMPERATURE = 0.6;

// How each container wants to be filled — handed to the model so the questions
// match the format the piece will publish as.
const FORMAT_BRIEF: Record<QueueFormat, string> = {
  QA: '3–5 open interview questions, each inviting a short story. This becomes a Q&A.',
  THIS_OR_THAT: '3–4 either/or prompts. For each, give two concrete options (optionA, optionB) drawn from the angle, and a one-line prompt asking the designer to pick and say why.',
  GET_TO_KNOW: '4–6 short, warm personal prompts that surface taste and point of view. Light, quick to answer.',
  MATERIAL_STUDY: '3–4 questions that go deep on the material at the center of the angle — sourcing, why it recurs, how they talk about it to clients.',
  METHOD: '3–4 questions about how the work actually happened — sequence, decisions, what changed.',
  DESIGNER_PROFILE: '4–5 questions about identity and place — what makes the practice theirs.',
};

function evidenceFactLines(angle: ExtractedAngle): string {
  const facts = angle.evidence.facts;
  if (!facts) return 'none';
  return Object.entries(facts)
    .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : value}`)
    .join('; ');
}

const SYSTEM_PROMPT = `${FOLIO_INTERVIEWER_PERSONA}

${SHARED_RULE_BLOCK}

${ARRIVALS_CONTRAST_POLICY}

YOUR TASK: you are handed ONE editorial angle about a designer's body of work, plus the FORMAT the finished piece will take. Write the specific prompts the designer will answer.

The whole point is specificity: every prompt must be grounded in THIS angle and its evidence — the kind of question that could only be asked of this designer. Never write a generic prompt ("what inspires you?").

Return ONLY a JSON object, no prose, no markdown fences:
{"intro": "one-line framing shown to the designer", "items": [{"prompt": "...", "hint": "what we're listening for", "optionA": "only for this_or_that", "optionB": "only for this_or_that"}]}
Omit optionA/optionB unless the format asks for them.`;

// Pure: assemble the user prompt from the angle + format. Testable without a call.
export function buildPromptGenUserPrompt(angle: ExtractedAngle, format: QueueFormat): string {
  return `ANGLE TYPE: ${angle.angleType}
EDITORIAL FRAMING: ${angle.summary}
SUPPORTING EVIDENCE (facts computed from the corpus): ${evidenceFactLines(angle)}

FORMAT: ${format}
WHAT THIS FORMAT NEEDS: ${FORMAT_BRIEF[format]}`;
}

// Pure: parse the model's JSON into a PromptStructure. Stamps stable ids on each
// item. Returns null on any structural problem so the caller can skip the item.
export function parsePromptResponse(raw: string, format: QueueFormat): PromptStructure | null {
  const cleaned = raw.replace(/```json\n?|\n?```/g, '').trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return null;
  }
  const obj = parsed as { intro?: unknown; items?: unknown };
  if (!Array.isArray(obj.items) || obj.items.length === 0) return null;

  const items: QueuePromptItem[] = [];
  for (const raw of obj.items) {
    if (!raw || typeof raw !== 'object') continue;
    const row = raw as Record<string, unknown>;
    if (typeof row.prompt !== 'string' || !row.prompt.trim()) continue;
    // Arrivals/contrast gate (docs/17 §3): drop any grievance/regret prompt.
    if (!isArrivalSafe(row.prompt.trim())) {
      console.info('[generatePrompts] arrivals gate dropped a prompt');
      continue;
    }
    const item: QueuePromptItem = { id: randomUUID(), prompt: row.prompt.trim() };
    if (typeof row.hint === 'string' && row.hint.trim()) item.hint = row.hint.trim();
    if (typeof row.optionA === 'string' && row.optionA.trim()) item.optionA = row.optionA.trim();
    if (typeof row.optionB === 'string' && row.optionB.trim()) item.optionB = row.optionB.trim();
    items.push(item);
  }
  if (items.length === 0) return null;

  const intro = typeof obj.intro === 'string' && obj.intro.trim() ? obj.intro.trim() : angleIntroFallback(format);
  return { format, intro, items };
}

function angleIntroFallback(format: QueueFormat): string {
  return format === 'GET_TO_KNOW'
    ? 'A few quick questions to get to know your work.'
    : 'A few questions about this piece.';
}

// The one Anthropic call. Returns the prompt structure, or null when the model
// is unavailable or the call/parse fails.
export async function generatePrompts(
  angle: ExtractedAngle,
  format: QueueFormat,
): Promise<PromptStructure | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;

  const client = new Anthropic();
  const result = await callLLM(
    () =>
      client.messages.create({
        model: MODELS.sonnet,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: buildPromptGenUserPrompt(angle, format) }],
        max_tokens: PROMPT_GEN_MAX_TOKENS,
        temperature: PROMPT_GEN_TEMPERATURE,
      }),
    { modelName: MODELS.sonnet, contextHint: 'operation=editorial_queue_prompt_generation', maxRetries: 2 },
  );

  if (result.ok) {
    const raw = result.data.content[0]?.type === 'text' ? result.data.content[0].text : '';
    return parsePromptResponse(raw, format);
  }

  const failureCode = 'code' in result ? result.code : 'unknown';
  console.warn('[generatePrompts] call failed', { code: failureCode, angleType: angle.angleType });
  return null;
}
