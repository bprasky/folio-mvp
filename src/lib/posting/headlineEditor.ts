// ============================================================================
// The editor's pass.
//
// The article is written by a senior writer working from the interview under an
// accuracy contract. The headline was written the same way — and then chosen by
// a regular expression. That asymmetry is the whole problem: a regex can only
// reject a shape someone already watched fail, so every new way of writing a bad
// headline is discovered in production, one word at a time. "so the rooms can
// argue" got banned; back came "the kitchen stone dictated every finish around
// it" and "a bright room asked for black anchors, not brass". Same failure, new
// verbs. Chasing the verbs is a game the list always loses.
//
// What a magazine actually does between "the writer submits twelve" and "one
// runs" is not a spellcheck. An editor reads them against the reporting and
// kills the ones with nothing behind them. That is this module.
//
// The division of labour, and why it is in this order:
//
//   headlineIssues()  — MECHANICAL. Length, casing, terminal punctuation, the
//                       byline's own names, shapes known to be dead. Free,
//                       deterministic, and it never has an opinion. Runs first
//                       so the editor is not spending tokens on a 19-word
//                       headline in Title Case.
//
//   judgeHeadlines()  — EDITORIAL. Is this about THIS project? Did it happen?
//                       Is there a reason to read on? And does it report a
//                       moment, or just deliver a verdict on the finished house?
//                       None of these are decidable by pattern, and all four are
//                       what separates the headlines that got complained about
//                       from the ones that did not.
//
// A separate call, not an instruction bolted onto the writer's prompt. A model
// asked to grade its own twelve suggestions defends them; a fresh context that
// did not write them and is told its job is to cut is markedly harsher. It is
// also given the interview and NOT the writer's reasoning, so it judges the line
// the way the reader meets it — cold, with only the reporting to check it
// against.
//
// This pass can only REMOVE and REORDER. It never writes or rewrites a headline,
// so nothing can leave here that did not survive the mechanical check first.
// ============================================================================

import Anthropic from '@anthropic-ai/sdk';
import { callLLM } from '@/lib/posting/llmClient';
import { MODELS } from '@/lib/ai/models';
import { JSON_PROSE_QUOTING_RULE } from '@/lib/interview/prompts/editorialTone';

const anthropic = new Anthropic();

export interface HeadlineVerdict {
  /** Index into the candidate array as passed in. */
  index: number;
  keep: boolean;
  /** The editor's one line. Logged on kills; never shown to the designer. */
  why: string;
  /**
   * For a keeper: the interview moment the editor says the headline reports.
   *
   * Asked for because it is the cheapest way to make UNSUPPORTED and VERDICT
   * bite. A model that must name the answer a headline came from cannot keep one
   * that came from nowhere without writing the lie down — and the same line,
   * logged, is how a human reading the logs can tell a grounded batch from a
   * fluent one. Never shown to the designer, and never required: an editor that
   * omits it still gets its verdict counted.
   */
  on?: string;
}

/**
 * The four ways a headline that passes every mechanical check is still wrong.
 *
 * Written as kill criteria rather than a quality score on purpose. "Rate these
 * 1-10" returns a spread of sevens and changes nothing; "which of these would
 * you not run, and why" is a decision, and it is the decision an editor is
 * actually making. Each criterion names the failure it catches so the model is
 * matching against a described defect rather than against its own taste.
 *
 * The fourth criterion is the one the first live batch bought. Every headline
 * the designer rejected — "Formal outside, unruly within, and both are true on
 * purpose", "Renovating finishes only, and still changing everything", "Glass
 * won the dining table argument by disappearing", "A reserved facade for clients
 * who never wanted flash" — was a VERDICT on the finished house rather than a
 * report of anything in it, and three of the four reached for a contrast to say
 * so. That is why the criterion names the counterfeit explicitly: a contrast has
 * the cadence of a claim, so "nothing at stake" does not fire on it. Two of them
 * are quoted into the prompt because a described defect is matched far more
 * reliably when the model has seen one.
 */
const EDITOR_SYSTEM = `You are the editor of a prestigious design magazine. A writer has submitted headline options for a feature. Your job is to CUT, not to write.

You have the designer's interview — the reporting the piece is built on. Judge every candidate against it.

KILL a headline for any of these four reasons. Be severe: it is much worse to run a weak headline than to run fewer options. The default is to kill. A headline earns its place by surviving all four, and most will not.

1. INTERCHANGEABLE — swap two nouns and it could run on any other project this year. "The kitchen stone dictated every finish around it" is the template for every house with a statement slab; it tells you the shape of a decision without telling you the decision. If you cannot say what is specific to THIS house, kill it.

2. UNSUPPORTED — the interview does not say this happened. The writer may have inferred it from how the finished house looks, or invented it outright. If you cannot point to the answer it came from, kill it.

3. NOTHING AT STAKE — accurate, specific, and there is still no reason to read the next line. Usually this is a caption: it describes how the house is arranged rather than what anyone did about it. Personifying the architecture is the tell — rooms that argue, stone that dictates, a bright room that asks for something. Nobody decided anything in those sentences; the building is performing a mood. Kill it.

4. VERDICT INSTEAD OF REPORT — it summarises what the project is LIKE rather than reporting something that happened. "Formal outside, unruly within, and both are true on purpose" and "Renovating finishes only, and still changing everything" are both conclusions about the finished house; no moment, no decision, nobody doing anything. The tell is a contrast or a paradox — two opposed qualities held together, or a concession ("only this, and still that"). Watch for it, because a contrast COUNTERFEITS a stake: it has the rhythm of a claim, so it can slip past reason 3 while nothing is actually at issue. A verdict about the house is not an event in it. Kill it.

Also a verdict: the headline commenting on its own cleverness — "and both are true on purpose", "and that is the point", "by design". That is the writer talking about the writing.

A headline you KEEP has to survive all four: something specific to this house, that the designer said happened, that a reader would want the rest of, and that reports a moment rather than delivering a verdict on the whole project.

The test for a keeper: name the moment in the interview it came from — the decision, the mistake, the thing that arrived wrong, the thing the client said. If you cannot point at one answer and say "this line is about that", it is not a keeper, however well written it is. A headline can be vivid, specific and accurate and still be a verdict.

Then RANK the survivors, best first. Best means: the one a stranger scrolling past is most likely to stop for, without having been misled about what the piece contains.

Return ONLY a JSON array, ranked, kept headlines first then killed ones:
[{"i": <number>, "keep": true|false, "why": "<one short line>", "on": "<for a keeper only: the interview moment it reports, in a few words>"}]

Every candidate index must appear exactly once. No preamble, no commentary, no code fence.

${JSON_PROSE_QUOTING_RULE}`;

/**
 * Judge a batch. Returns verdicts in the editor's ranked order.
 *
 * Returns `null` — never throws, never an empty list — when the call fails or
 * comes back unusable. The caller falls back to the mechanically-filtered batch
 * rather than losing the feature: an editor who is out is a reason to ship the
 * writer's order, not a reason to ship nothing.
 */
export async function judgeHeadlines(opts: {
  candidates: string[];
  interview: string;
  projectTitle?: string | null;
  location?: string | null;
  cid?: string;
}): Promise<HeadlineVerdict[] | null> {
  const { candidates, interview, projectTitle, location, cid } = opts;
  if (candidates.length === 0) return null;

  const userPrompt = `## The reporting
The designer's own words. Nothing in a headline is allowed to go beyond this.
${interview || '(no interview answers on file)'}

## The project
${projectTitle ? `Working title: ${projectTitle}` : ''}
${location ? `Location: ${location}` : ''}

## The candidates
${candidates.map((t, i) => `${i}. ${t}`).join('\n')}

Judge all ${candidates.length}. Return the JSON array, ranked, kept first.`;

  const modelName = MODELS.sonnet;
  const llm = await callLLM(
    async () =>
      anthropic.messages.create({
        model: modelName,
        thinking: { type: 'disabled' },
        max_tokens: 1200,
        system: EDITOR_SYSTEM,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    { modelName, contextHint: `headline-editor:${cid ?? ''}`, baseDelayMs: 500 },
  );

  if (!llm.ok) {
    console.warn('[headline/editor] pass unavailable, keeping the writer\'s order', {
      cid, code: (llm as any).code,
    });
    return null;
  }

  const text: string = ((llm.data as any).content ?? [])
    .filter((b: any) => b.type === 'text')
    .map((b: any) => b.text)
    .join('');

  const match = text.match(/\[[\s\S]*\]/);
  if (!match) {
    console.warn('[headline/editor] no JSON array in response', { cid });
    return null;
  }

  let raw: unknown;
  try {
    raw = JSON.parse(match[0]);
  } catch {
    console.warn('[headline/editor] malformed JSON', { cid });
    return null;
  }
  if (!Array.isArray(raw)) return null;

  // Only verdicts on candidates that exist, one per candidate, in the order the
  // editor returned them — that order IS the ranking.
  const claimed = new Set<number>();
  const verdicts: HeadlineVerdict[] = [];
  for (const entry of raw) {
    const index = typeof (entry as any)?.i === 'number' ? (entry as any).i : NaN;
    if (!Number.isInteger(index) || index < 0 || index >= candidates.length) continue;
    if (claimed.has(index)) continue;
    claimed.add(index);
    verdicts.push({
      index,
      keep: (entry as any)?.keep === true,
      why: typeof (entry as any)?.why === 'string' ? (entry as any).why : '',
      on: typeof (entry as any)?.on === 'string' ? (entry as any).on : undefined,
    });
  }

  // A partial verdict list would silently drop candidates the editor never
  // ruled on — indistinguishable from a kill, and a kill nobody decided. An
  // unjudged candidate is not a rejected one, so an incomplete pass is discarded
  // whole and the writer's order stands.
  if (verdicts.length !== candidates.length) {
    console.warn('[headline/editor] incomplete verdicts, discarding the pass', {
      cid, judged: verdicts.length, candidates: candidates.length,
    });
    return null;
  }

  return verdicts;
}
