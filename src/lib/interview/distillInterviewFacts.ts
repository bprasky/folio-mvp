/**
 * Fact Digest — the bridge between the "About This Project" section and
 * room-level question generation.
 *
 * The designer's project-level answers carry both FACTS (who the client is,
 * what the scope was) and NARRATIVE (their emphasis, their emotional framing).
 * Room questions should be informed by the facts — like an interviewer who
 * took notes during the opening conversation — but never re-steered by the
 * narrative, or every section starts chasing whatever the designer was
 * effusive about.
 *
 * The fixed schema below is the structural guarantee: there is no field an
 * agenda can ride in on. Distillation extracts neutral facts into these slots
 * and drops everything else.
 */

import Anthropic from '@anthropic-ai/sdk';
import { MODELS } from '@/lib/ai/models';

export interface KnownFacts {
  /** Who the client is (composition, situation) — no names, no editorializing */
  client?: string;
  /** What the work was (new build / renovation / furnishing, extent) */
  scope?: string;
  /** How long it took / when it happened */
  timeline?: string;
  /** The stated design direction or big idea, in neutral terms */
  direction?: string;
  /** Places the designer corrected or contradicted the project metadata */
  corrections?: string;
}

const FACT_FIELDS: Array<keyof KnownFacts> = [
  'client',
  'scope',
  'timeline',
  'direction',
  'corrections',
];

const MAX_FIELD_LENGTH = 220;

/**
 * Distill project-level interview answers into a neutral fact digest.
 * Returns null when there is nothing usable or the LLM call fails —
 * callers must treat the digest as an enhancement, never a dependency.
 */
export async function distillInterviewFacts(
  answers: Array<{ prompt: string; answer: string }>,
): Promise<KnownFacts | null> {
  const usable = answers.filter((a) => a.answer && a.answer.trim().length > 0);
  if (usable.length === 0) return null;

  const qaText = usable
    .map((a) => `Q: ${a.prompt || '(question unavailable)'}\nA: ${a.answer.trim().slice(0, 1500)}`)
    .join('\n\n');

  const prompt = `You are preparing an interviewer's notebook. A designer just answered opening questions about an interior design project. Extract ONLY the neutral facts an interviewer would jot down before moving on to room-by-room questions.

STRICT RULES:
- Facts only. Strip all emotional emphasis, storytelling, and the designer's rhetorical framing. "Clients relocated for work; two young children" — not "a heartwarming journey of a family starting over."
- Third person, plain shorthand. Each field is one sentence fragment, under ${MAX_FIELD_LENGTH} characters.
- NEVER include personal names of clients, children, or pets — describe roles instead ("couple with two young kids").
- Omit any field the answers don't cover. Do not infer or invent.
- "corrections" is only for places the designer contradicted or revised something (e.g. "timeline was 16 months, not 14"). Usually omitted.

DESIGNER'S ANSWERS:
${qaText}

Return ONLY a JSON object with any of these optional string keys: "client", "scope", "timeline", "direction", "corrections". No other keys, no prose.`;

  try {
    const anthropic = new Anthropic();
    const response = await anthropic.messages.create({
      model: MODELS.haiku,
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }],
    });

    const responseText = response.content.find((c) => c.type === 'text');
    const text = responseText && 'text' in responseText ? responseText.text : '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);
    const facts: KnownFacts = {};
    for (const field of FACT_FIELDS) {
      const value = parsed?.[field];
      if (typeof value === 'string' && value.trim().length > 0) {
        facts[field] = value.trim().slice(0, MAX_FIELD_LENGTH);
      }
    }

    return Object.keys(facts).length > 0 ? facts : null;
  } catch (err) {
    console.warn('[distillInterviewFacts] Distillation failed (non-blocking):', err);
    return null;
  }
}

const FIELD_LABELS: Record<keyof KnownFacts, string> = {
  client: 'The clients',
  scope: 'The scope',
  timeline: 'The timeline',
  direction: 'The direction',
  corrections: 'Corrections to earlier notes',
};

/** Render a digest as prompt-ready bullet lines. Returns '' for empty/null digests. */
export function formatKnownFacts(facts: KnownFacts | null | undefined): string {
  if (!facts) return '';
  return FACT_FIELDS
    .filter((f) => facts[f])
    .map((f) => `- ${FIELD_LABELS[f]}: ${facts[f]}`)
    .join('\n');
}
