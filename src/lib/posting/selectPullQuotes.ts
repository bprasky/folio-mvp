import Anthropic from '@anthropic-ai/sdk';

import { MODEL_FOR } from '@/lib/ai/models';
import { thinkingSettingsFor, thinkingParams, firstTextBlock } from '@/lib/ai/thinking';
import { reportAiIncident } from '@/lib/ai/errors';
import { formatRoomName } from '@/lib/utils/formatRoomName';
import { callLLM } from './llmClient';
import {
  extractQuoteCandidates,
  isVerbatimSpan,
  normalizeForVerbatimCheck,
  type AnswerLike,
  type QuoteCandidate,
} from './quoteCandidates';
import type { PullQuoteSelection } from './schemas';

const client = new Anthropic();

// ============================================================================
// Rank verbatim candidates. Never write one.
//
// The model receives numbered candidates and returns IDs. It never returns
// text, so there is nothing for it to alter: we look the ID up in our own array
// and use OUR string. The worst a misbehaving model can do is pick a duller
// quote — it cannot pick a quote the designer did not say, because no such
// string is in the array.
//
// Everything is checked again after selection anyway. A returned ID that does
// not exist, or a text that somehow fails a verbatim check against its source
// answer, falls back to the top code-ranked candidate rather than shipping
// anything unverified. Selection failing closed is the whole point.
// ============================================================================

const SYSTEM = `You are a magazine editor choosing the single pull quote for each room of a design feature.

You are given, per room, a numbered list of things the designer ACTUALLY SAID, transcribed verbatim from their interview.

Your only job is to choose. You do not write, rewrite, trim, tidy, punctuate, or combine anything. You return IDs.

Choose the line that:
- says something specific about THIS room — a decision, a material, a constraint, a reversal
- carries the designer's voice rather than a generic sentiment
- reads as a standalone display line, without needing the question that prompted it
- is not merely descriptive of what a photograph already shows

Return null for a room when NOTHING in its list is worth setting in large type. A missing pull quote is correct and expected; a weak one is not. Do not stretch for a choice.

Return ONLY a JSON object mapping room name to candidate id or null:
{"Kitchen": "q3", "Powder Room": null}`;

export interface PullQuoteAssignment {
  /** room name (formatted) -> selection, or null when nothing qualified */
  byRoom: Record<string, PullQuoteSelection | null>;
  /** Rooms whose own answers produced no quotable candidate at all. */
  roomsWithNoCandidates: string[];
  /** Rooms where the model's pick failed verification and we fell back. */
  roomsFailedVerification: string[];
}

/** How many verbatim options the designer can shuffle through, including the pick. */
const SHUFFLE_POOL = 6;

/**
 * Build the selection the designer shuffles through before posting.
 *
 * `alternatives` INCLUDES the chosen candidate, in rank order. That is not
 * redundancy — the editing UI finds its position with
 * `alternatives.findIndex(a => a.text === selectedText)` and cycles from there,
 * so leaving the pick out makes the index -1 and the arrows toggle between two
 * fixed entries instead of walking the list. The PATCH endpoint also rejects any
 * `selectedText` not present here, so omitting it would make the designer's
 * original pick the one thing they could not cycle back to.
 *
 * Every entry is verbatim, so shuffling can never introduce something the
 * designer did not say. The model chose the default; the designer chooses the
 * quote.
 */
export function buildShufflePool(
  chosen: QuoteCandidate,
  ranked: QuoteCandidate[],
  cap: number = SHUFFLE_POOL,
): QuoteCandidate[] {
  const pool: QuoteCandidate[] = [];
  for (const c of [chosen, ...ranked.filter(x => x.id !== chosen.id)]) {
    if (pool.length >= cap) break;
    const a = normalizeForVerbatimCheck(c.text);
    if (pool.some(p => {
      const b = normalizeForVerbatimCheck(p.text);
      return a.includes(b) || b.includes(a);
    })) continue;
    pool.push(c);
  }
  return pool;
}

function toSelection(chosen: QuoteCandidate, ranked: QuoteCandidate[]): PullQuoteSelection {
  const pool = buildShufflePool(chosen, ranked);
  return {
    selected: { text: chosen.text },
    alternatives: pool.map((c, i) => ({ text: c.text, score: 1 - i * 0.1 })),
  };
}

/**
 * Choose one verbatim pull quote per room.
 *
 * `roomNames` are the RAW interview section names; the returned map is keyed by
 * `formatRoomName(...)` so it lines up with assembled chapter titles.
 */
export async function selectPullQuotes(
  roomNames: string[],
  answers: AnswerLike[],
  _cid: string,
  projectId?: string | null,
): Promise<PullQuoteAssignment> {
  const byRoom: Record<string, PullQuoteSelection | null> = {};
  const roomsWithNoCandidates: string[] = [];
  const roomsFailedVerification: string[] = [];

  const pools = new Map<string, QuoteCandidate[]>();
  for (const room of roomNames) {
    const candidates = extractQuoteCandidates(answers, room);
    const label = formatRoomName(room);
    if (candidates.length === 0) {
      // No borrowing from other rooms. Follow-ups are prompted for quotable
      // material, so an empty pool means that room's follow-up did not land —
      // a gap to fix in the interview, not to fill with someone else's words.
      byRoom[label] = null;
      roomsWithNoCandidates.push(label);
      continue;
    }
    pools.set(room, candidates.slice(0, 12));
  }

  if (pools.size === 0) {
    return { byRoom, roomsWithNoCandidates, roomsFailedVerification };
  }

  const prompt = Array.from(pools.entries())
    .map(([room, cs]) =>
      `## ${formatRoomName(room)}\n${cs.map(c => `${c.id}. ${c.text}`).join('\n')}`,
    )
    .join('\n\n');

  const thinking = thinkingSettingsFor('editorial');
  const llm = await callLLM(
    async () =>
      client.messages.create({
        model: MODEL_FOR.prose,
        ...thinkingParams(thinking),
        max_tokens: 1000,
        system: SYSTEM,
        messages: [{ role: 'user', content: prompt }],
      }),
    { modelName: MODEL_FOR.prose, contextHint: `pullquotes:${projectId ?? ''}`, maxRetries: 1 },
  );

  let picked: Record<string, unknown> = {};
  if (llm.ok) {
    try {
      picked = JSON.parse(firstTextBlock(llm.data).replace(/```json\n?|\n?```/g, '').trim());
    } catch {
      // Ranking is advisory. A malformed response costs us the editorial
      // judgement, not the quote — code ranking already ordered every pool.
      console.warn('[pullquotes] ranking response unparseable; using code ranking', { _cid });
    }
  } else {
    console.warn('[pullquotes] ranking call failed; using code ranking', { _cid, code: (llm as any).code });
  }

  for (const [room, candidates] of Array.from(pools.entries())) {
    const label = formatRoomName(room);
    const sources = answers.filter(a => (a.section ?? '') === room).map(a => a.answer);

    const wanted = picked[label];
    let chosen: QuoteCandidate | undefined;

    if (wanted === null) {
      // The editor judged nothing worth setting in type. Respected — that is
      // the outcome this prompt explicitly asks for over a weak quote.
      byRoom[label] = null;
      continue;
    }
    if (typeof wanted === 'string') chosen = candidates.find(c => c.id === wanted);

    // Fail closed: unknown id, wrong type, or a text that does not appear in the
    // source answer all land on the top code-ranked candidate.
    if (chosen && !isVerbatimSpan(chosen.text, sources)) {
      roomsFailedVerification.push(label);
      chosen = undefined;
    }
    if (!chosen) {
      if (typeof wanted === 'string') roomsFailedVerification.push(label);
      chosen = candidates.find(c => isVerbatimSpan(c.text, sources));
    }

    byRoom[label] = chosen ? toSelection(chosen, candidates) : null;
  }

  if (roomsFailedVerification.length > 0) {
    await reportAiIncident({
      code: 'LLM_QUOTE_UNVERIFIED',
      operation: 'pullquotes',
      projectId: projectId ?? null,
      correlationId: _cid,
      model: MODEL_FOR.prose,
      diagnostic: { roomsFailedVerification, roomsWithNoCandidates },
    });
  }
  if (roomsWithNoCandidates.length > 0) {
    // Not an incident — an interview-quality signal. Rooms listed here have no
    // quotable follow-up answer, which is the thing to fix upstream.
    console.info('[pullquotes] rooms with no quotable candidate', { _cid, roomsWithNoCandidates });
  }

  return { byRoom, roomsWithNoCandidates, roomsFailedVerification };
}
