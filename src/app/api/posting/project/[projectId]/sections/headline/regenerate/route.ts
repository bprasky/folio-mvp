export const dynamic = 'force-dynamic';

/**
 * POST — Propose new headlines for an article.
 *
 * Deliberately NOT "regenerate the headline". A button that swaps in one fresh
 * headline per press is a slot machine: press three can be worse than press one
 * and there is no way back, so the feature trains designers not to touch it.
 *
 * This asks for a batch, throws away every candidate that fails the house style
 * check, and stores the survivors as alternatives. The live headline does not
 * change until the designer picks one — the same cycle-and-choose interaction as
 * the pull quote picker, and a bad batch costs nothing.
 *
 * The criteria are HEADLINE_CRITERIA, the same string the full generator writes
 * headlines from, and the filter is `headlineIssues`, the machine-checkable half
 * of that same contract. A regenerated headline is therefore graded by exactly
 * the rules that produced the one it would replace.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import Anthropic from '@anthropic-ai/sdk';

import { prisma } from '@/lib/prisma';
import { assertProjectWrite } from '@/lib/authz/access';
import { callLLM } from '@/lib/posting/llmClient';
import { MODELS } from '@/lib/ai/models';
import { cid as newCid } from '@/lib/utils/correlation';
import {
  EVALUATIVE_ADJECTIVES,
  FOLIO_TONE,
  HEADLINE_CRITERIA,
  JSON_PROSE_QUOTING_RULE,
  toTypographicQuotes,
} from '@/lib/interview/prompts/editorialTone';
import {
  eligibleFrames,
  renderFrameInstruction,
} from '@/lib/interview/prompts/headlineFrames';
import {
  BANNED_HEADLINE_VERBS_RULE,
  selectVerbs,
  renderVerbInstruction,
} from '@/lib/interview/prompts/headlineVerbs';
import { resolveHeadlineSlots, borrowedFragmentIsVerbatim } from '@/lib/posting/headlineSlots';
import {
  normalizeHeadline,
  headlineIssues,
  HEADLINE_MAX_WORDS,
} from '@/lib/posting/headline';
import { normalizeForVerbatimCheck } from '@/lib/posting/quoteCandidates';
import { loadInterviewAnswers } from '@/lib/posting/loadInterviewAnswers';
import { judgeHeadlines } from '@/lib/posting/headlineEditor';

const anthropic = new Anthropic();

/**
 * One headline per angle, rather than N free-form.
 *
 * A single instruction repeated twelve times returns twelve versions of one
 * thought — which is why a batch could feel flat even when no individual entry
 * was wrong. Each angle names a DIFFERENT thing to write about, so the spread is
 * structural instead of hoped for, and the designer picks the angle that fits
 * the project rather than the least-bad phrasing of one angle.
 *
 * Every one of these asks for something that HAPPENED. That is deliberate: a
 * headline drawn from how the house is arranged ("bold in the kitchen, soft in
 * the bedroom") is a caption, and arrangement is all the article's own prose can
 * offer. Events live in the interview.
 */
const ANGLES: Array<{ key: string; brief: string }> = [
  { key: 'reversal', brief: 'A decision that could easily have gone the other way, and did not. What was nearly chosen instead?' },
  { key: 'constraint', brief: 'A limit someone had to beat — a budget, a schedule, a structural fact, a room that would not cooperate.' },
  { key: 'accident', brief: 'Something that went wrong, or arrived wrong, and was kept anyway.' },
  { key: 'client', brief: 'What the client actually asked for, in their terms, especially if it sounds unreasonable out of context.' },
  { key: 'first-move', brief: 'The one selection that set everything after it — the material or object the rest of the house had to answer to.' },
  { key: 'argument', brief: 'A claim about this project a reasonable designer could disagree with. Take a position.' },
];

/** Asked for. One per angle. */
const CANDIDATES_REQUESTED = ANGLES.length * 2;
/** Kept. Enough to cycle without turning the arrows into a chore. */
const CANDIDATES_KEPT = 6;

const SYSTEM_PROMPT = `You are a senior writer for a prestigious design magazine, writing headline options for a feature article about an interior design project.

${FOLIO_TONE}

${HEADLINE_CRITERIA}

${EVALUATIVE_ADJECTIVES}

${BANNED_HEADLINE_VERBS_RULE}

Return ONLY a JSON array of headline strings. No preamble, no commentary, no code fence.

${JSON_PROSE_QUOTING_RULE}`;

export async function POST(
  request: NextRequest,
  { params }: { params: { projectId: string } },
) {
  const _cid = newCid('headline-regen');
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { projectId } = params;
    await assertProjectWrite(session.user.id, projectId);

    const body = await request.json().catch(() => ({}));
    const feedback = typeof body?.feedback === 'string' ? body.feedback.trim() : '';

    const post = await prisma.projectPost.findUnique({
      where: { projectId },
      select: { id: true, expandedBlocks: true },
    });
    if (!post?.expandedBlocks) {
      return NextResponse.json({ error: 'No article to write a headline for' }, { status: 404 });
    }

    const blocks = post.expandedBlocks as Record<string, any>;
    const currentKicker: string = blocks.lead?.kicker ?? blocks.lead?.title ?? '';

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        title: true,
        city: true,
        regionState: true,
        designer: { select: { name: true } },
        designerOrg: { select: { name: true } },
      },
    });
    // Who the byline credits. The headline must not repeat it — see the
    // NAMES_PEOPLE rule, which is enforced rather than merely asked for.
    const names = {
      designerName: project?.designer?.name ?? null,
      orgName: project?.designerOrg?.name ?? null,
    };

    // The interview — the events.
    //
    // This endpoint used to write headlines from the article's own introduction,
    // its hook quote and its current headline. All three are prose that has
    // ALREADY abstracted the project, so the writer had nothing to report and
    // could only recombine the vocabulary it was handed: a deck reading "every
    // room argues its own case" came back as the suggestion "the exterior stays
    // quiet so the rooms can argue".
    //
    // Follow-up answers first — they are the ones prompted for anecdote, so they
    // are where a decision or a reversal is actually described. This is the same
    // correction the pull quotes needed: source from the interview, not from the
    // prose written about it.
    const answers = await loadInterviewAnswers(projectId);
    const byInterest = [...answers].sort((a, b) => Number(b.isFollowUp) - Number(a.isFollowUp));
    const answerText = byInterest
      .slice(0, 24)
      .map((a) => `- [${a.section}] ${toTypographicQuotes(a.answer.trim())}`)
      .join('\n');

    // The headline describes the ARTICLE, so the article is the context: what it
    // opens with, which rooms it covers, and the designer's own framing line.
    const introduction: string[] = Array.isArray(blocks.introduction) ? blocks.introduction : [];
    const chapterTitles: string[] = (Array.isArray(blocks.galleryChapters) ? blocks.galleryChapters : [])
      .map((c: any) => c?.title)
      .filter((t: any): t is string => typeof t === 'string' && !!t.trim());
    const hookQuote: string | null =
      typeof blocks.hookQuote?.text === 'string' ? blocks.hookQuote.text : null;
    const location = [project?.city, project?.regionState].filter(Boolean).join(', ');

    // The frame library.
    //
    // Materials are structured on the row and this endpoint was passed none of
    // them — the audit's F8. So the FIRST-MOVE angle ("the material the rest of
    // the house had to answer to") was being asked of a writer that had never
    // been told which materials exist, and it answered from the interview prose
    // or from nothing.
    //
    // Two things change when a confirmed material exists. The verified values go
    // into the prompt as facts, and the FIRST-MOVE angle stops being a topic and
    // becomes a SHAPE: material as grammatical subject, designer as agent in the
    // tail. Eligibility is decided here, in code — the model is never asked
    // whether it has enough to write a material headline, because a model asked
    // that says yes.
    //
    // This surface HAS a deck (`blocks.lead.deck`), so deck-requiring frames are
    // eligible here. Three of the five title surfaces do not — see docs/23.
    const { slots, materials, facts, confirmedFinishTags, fragments, answerTexts } =
      await resolveHeadlineSlots(projectId);
    const frames = eligibleFrames(slots, { hasDeck: true });
    // The verb library, gated on the same structured facts.
    //
    // Only what the data can decide is passed: `materialClass` and, when a class
    // appears in more than one room or image, `classInTwoPlaces`. Everything else
    // is ABSENT rather than false, which withholds rather than permits — so every
    // Intervention verb stays out (no per-project new-build field exists) and so do
    // Application, Placement, Division and Aperture, whose preconditions nothing
    // can currently answer. See docs/23 §6.2 and §7.
    const verbs = selectVerbs(facts);
    const materialFrame = frames.find((f) => f.id === 'material') ?? null;
    const fragmentFrame = frames.find((f) => f.id === 'borrowed-fragment') ?? null;
    // Position IS the angle (entry 2i and 2i+1 are ANGLES[i]), so a frame replaces
    // an angle in place rather than adding a candidate. Each frame takes the angle
    // that was already asking for its material: FIRST-MOVE wanted the material the
    // house answered to, and CLIENT wanted what the client said "in their terms",
    // which is a borrowed fragment with the quotation marks left off.
    const framesByAngle = new Map<number, typeof materialFrame>();
    if (materialFrame) framesByAngle.set(ANGLES.findIndex((a) => a.key === 'first-move'), materialFrame);
    if (fragmentFrame) framesByAngle.set(ANGLES.findIndex((a) => a.key === 'client'), fragmentFrame);
    const framedAngleIndex = materialFrame ? ANGLES.findIndex((a) => a.key === 'first-move') : -1;

    const userPrompt = `Write ${CANDIDATES_REQUESTED} headline options for this article — ${ANGLES.length} angles, two per angle.

## What the designer told us happened
These are their own words from the interview. This is your source material: a
headline has to come from something in here that WAS DECIDED, WENT WRONG, WAS
NEARLY DIFFERENT, or COST SOMETHING. Not from how the finished house looks.
${answerText || '(no interview answers on file)'}

## The project
${project?.title ? `Working title: ${project.title}` : ''}
${location ? `Location: ${location}` : ''}
${names.orgName ? `Credited to: ${names.orgName}` : names.designerName ? `Credited to: ${names.designerName}` : ''} — do NOT name them in the headline
Rooms covered: ${chapterTitles.length > 0 ? chapterTitles.join(', ') : 'unspecified'}
${fragmentFrame && fragments.length > 0 ? `
## What the designer said, word for word — QUOTABLE
Any of these may be quoted in a headline, exactly as written. They are the only
spans you may put inside quotation marks. Do not shorten, extend, tidy or re-punctuate
one, and never quote anything that is not on this list.
${fragments.slice(0, 10).map((f) => `- \u201C${f.text}\u201D`).join('\n')}
` : ''}${materials.length > 0 ? `
## Materials the designer specified — VERIFIED
Each of these was typed by the designer onto a tagged product, not inferred from a
photograph and not read out of the interview. You may state these as fact. Do not
add a material that is not on this list, and do not name a product or a brand.
${materials.slice(0, 8).map((m) => `- ${m.value} (specified across ${m.imageCount} image${m.imageCount === 1 ? '' : 's'})`).join('\n')}
` : ''}
## Context, NOT source material
The article's own opening and its current headline are below so you do not repeat
them. Do not mine them for phrasing — they describe the finished house, and a
headline built from them will describe it too.

${introduction.length > 0 ? `Opening: ${toTypographicQuotes(introduction.join(' '))}` : '(no introduction written yet)'}
${hookQuote ? `\nThe designer's framing: “${toTypographicQuotes(hookQuote)}”` : ''}
${currentKicker ? `\nCurrent headline — do NOT repeat or paraphrase: ${toTypographicQuotes(currentKicker)}` : ''}

${feedback ? `## What the designer wants changed\n${toTypographicQuotes(feedback)}\n` : ''}
## Write two for each of these angles, in this order
${ANGLES.map((a, i) => `${i * 2 + 1}. and ${i * 2 + 2}. ${a.key.toUpperCase()} — ${framesByAngle.has(i) ? `write these two to the ${framesByAngle.get(i)!.name.toUpperCase()} frame below, not freely.` : a.brief}`).join('\n')}
${Array.from(framesByAngle.values()).filter(Boolean).map((f) => `
${renderFrameInstruction(f!, slots)}
`).join('')}${verbs.eligible.length > 0 ? `
${renderVerbInstruction(verbs)}
` : ''}
If an angle has nothing in the interview to support it, write a weaker headline
from a different angle rather than inventing an event. Never state something the
designer did not say happened.

Return ONLY a JSON array of ${CANDIDATES_REQUESTED} strings, in that order.`;

    const modelName = MODELS.sonnet;
    const llm = await callLLM(
      async () =>
        anthropic.messages.create({
          model: modelName,
          thinking: { type: 'disabled' },
          max_tokens: 800,
          system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content: userPrompt }],
        }),
      { modelName, contextHint: `headline:${projectId}`, baseDelayMs: 500 },
    );

    if (!llm.ok) {
      console.error('[headline/regenerate] LLM failed', { _cid, code: (llm as any).code });
      return NextResponse.json(
        { error: 'Could not reach the writer. Please try again.' },
        { status: 502 },
      );
    }

    const responseText: string = ((llm.data as any).content ?? [])
      .filter((b: any) => b.type === 'text')
      .map((b: any) => b.text)
      .join('');

    const match = responseText.match(/\[[\s\S]*\]/);
    if (!match) {
      console.error('[headline/regenerate] no JSON array in response', { _cid });
      return NextResponse.json({ error: 'The writer returned malformed output. Please try again.' }, { status: 502 });
    }

    let raw: unknown;
    try {
      raw = JSON.parse(match[0]);
    } catch {
      // No prose-splitting fallback here, unlike the section route: a malformed
      // array of headlines has nothing worth salvaging, and splicing raw JSON
      // into a headline is the loudest possible place for that to show up.
      console.error('[headline/regenerate] malformed JSON array', { _cid });
      return NextResponse.json({ error: 'The writer returned malformed output. Please try again.' }, { status: 502 });
    }

    if (!Array.isArray(raw)) {
      return NextResponse.json({ error: 'The writer returned malformed output. Please try again.' }, { status: 502 });
    }

    // Filter, don't trust. Every candidate is graded by the same rules the
    // criteria state, and anything failing is dropped rather than offered — the
    // point of the batch is that the designer only ever cycles through headlines
    // that already conform.
    const seen = new Set<string>();
    if (currentKicker) seen.add(normalizeForVerbatimCheck(currentKicker));

    const rejected: Array<{ text: string; why: string }> = [];
    // Survivors keep the position they were asked at, because position IS the
    // angle: entry 2i and 2i+1 are the two takes on ANGLES[i].
    const survivors: Array<{ text: string; index: number }> = [];

    raw.forEach((entry, index) => {
      if (typeof entry !== 'string') return;
      const text = normalizeHeadline(entry);
      if (!text) return;

      const key = normalizeForVerbatimCheck(text);
      if (seen.has(key)) return; // duplicate, or the headline they already have
      seen.add(key);

      const issues = headlineIssues(text, names);
      if (issues.length > 0) {
        rejected.push({ text, why: issues.map((i) => `${i.code}: ${i.detail}`).join('; ') });
        return;
      }

      // Anything in quotation marks must actually have been said.
      //
      // Applied to EVERY candidate, not only the borrowed-fragment angle: the model
      // does not always keep to the position it was asked for, and a headline is the
      // worst place in the piece to attribute words to a designer that they did not
      // use. This is the same contract the pull quote pipeline holds — a quote is
      // selected, never written — checked with the same `isVerbatimSpan`.
      if (/[\u201C"]/.test(text) && !borrowedFragmentIsVerbatim(text, answerTexts)) {
        rejected.push({ text, why: 'QUOTE_UNVERIFIED: quotes words the designer did not say' });
        return;
      }
      survivors.push({ text, index });
    });

    // Take the FIRST take on every angle before the second take on any of them.
    //
    // Taking survivors in order would fill the pool from the first few angles —
    // six variations on "a decision that could have gone the other way" — which
    // is the flat batch this restructuring exists to prevent. The designer
    // should be choosing between kinds of headline, not phrasings of one.
    const takeOrder = (a: { index: number }, b: { index: number }) => {
      const rank = (i: number) => (i % 2) * ANGLES.length + Math.floor(i / 2);
      return rank(a.index) - rank(b.index);
    };

    // The editor's pass.
    //
    // Everything above this line is mechanical: it enforces length, casing, the
    // byline's names, and shapes already known to be dead. That is a spellcheck,
    // and it was the ONLY thing standing between the writer and the designer —
    // so a headline nobody had thought to ban yet went straight through. Banning
    // "the rooms argue" produced "the stone dictated" and "the room asked for";
    // the list always loses that race.
    //
    // So the batch is now read by an editor before anyone sees it, judged against
    // the same interview the writer worked from, and cut for the three things a
    // pattern cannot see: whether it could run on somebody else's project,
    // whether it actually happened, and whether there is any reason to read on.
    const verdicts = await judgeHeadlines({
      candidates: survivors.map((s) => s.text),
      interview: answerText,
      projectTitle: project?.title,
      location,
      cid: _cid,
    });

    let kept: string[];
    let editorCut = 0;
    if (verdicts) {
      // The editor's order is the ranking — but a ranking alone can put six
      // phrasings of the strongest angle at the top, which is the flat batch the
      // angles exist to prevent. So the best surviving headline from each angle
      // is seated first, and the remaining slots are filled by rank. Both
      // properties hold: the pool opens with the editor's pick and still spans
      // what the designer could be choosing between.
      const keeps = verdicts.filter((v) => v.keep).map((v) => survivors[v.index]);
      editorCut = verdicts.length - keeps.length;
      const angleOf = (i: number) => Math.floor(i / 2);
      const seenAngles = new Set<number>();
      const bestPerAngle = keeps.filter((s) => {
        const a = angleOf(s.index);
        if (seenAngles.has(a)) return false;
        seenAngles.add(a);
        return true;
      });
      const rest = keeps.filter((s) => !bestPerAngle.includes(s));
      kept = [...bestPerAngle, ...rest].slice(0, CANDIDATES_KEPT).map((s) => s.text);

      const killed = verdicts.filter((v) => !v.keep);
      if (killed.length > 0) {
        console.info('[headline/regenerate] editor cuts', {
          _cid,
          cuts: killed.slice(0, 6).map((v) => ({ text: survivors[v.index].text, why: v.why })),
        });
      }
      // What survived, and what the editor says each one REPORTS.
      //
      // The cuts alone cannot tell you whether the pass is working. A batch of
      // fluent verdicts kept for good-sounding reasons looks identical in the
      // logs to a batch of grounded headlines until you can see what each keeper
      // is supposedly about — `on` is the editor naming the interview moment,
      // and a keeper whose moment is vague ("the overall approach") is the pass
      // failing quietly rather than cutting.
      console.info('[headline/regenerate] editor keeps', {
        _cid,
        keeps: verdicts.filter((v) => v.keep).slice(0, 8).map((v) => ({
          angle: ANGLES[Math.floor(survivors[v.index].index / 2)]?.key,
          text: survivors[v.index].text,
          on: v.on ?? '(the editor did not say)',
        })),
      });
    } else {
      // No editor: ship the mechanically-clean batch in angle order rather than
      // nothing. A judgement pass that is unavailable is a reason to lose the
      // ranking, not a reason to lose the feature.
      kept = [...survivors].sort(takeOrder).slice(0, CANDIDATES_KEPT).map((s) => s.text);
      // Said loudly and at this level on purpose. The batch the designer sees is
      // the writer's, unjudged — which is a different product from the one the
      // pipeline is supposed to ship, and the only way to tell from the outside
      // is that the headlines are worse. Anyone diagnosing a bad batch needs to
      // know which of the two they are looking at before they change a prompt.
      console.warn('[headline/regenerate] NO EDITOR — shipping the writer\'s unjudged batch', {
        _cid, survivedRules: survivors.length, kept: kept.length,
      });
    }

    // Whether a frame fired, and on what. Without this a framed batch and a free
    // one are indistinguishable in the logs, and the only symptom of an
    // ineligible frame is that the headlines are no better than before.
    console.info('[headline/regenerate] frames', {
      _cid,
      materialClasses: materials.length,
      topMaterial: materials[0]?.value ?? null,
      // The B1 gate beside the B3 one, so a single project shows the difference
      // the repoint made. The aggregate needs a database — docs/23 §6.2.
      confirmedFinishTags,
      classInTwoPlaces: facts.classInTwoPlaces === true,
      eligible: frames.map((f) => f.id),
      quotableFragments: fragments.length,
      framedAngles: Array.from(framesByAngle.entries()).map(([i, f]) => `${ANGLES[i].key}:${f!.id}`),
      framedAngle: framedAngleIndex >= 0 ? ANGLES[framedAngleIndex].key : null,
      verbsOffered: verbs.eligible.map((v) => v.id),
      verbsWithheld: verbs.withheld.length,
    });

    console.info('[headline/regenerate] candidates', {
      _cid, requested: CANDIDATES_REQUESTED, returned: raw.length,
      survivedRules: survivors.length, editorCut, edited: !!verdicts,
      kept: kept.length, rejected: rejected.length,
      anglesCovered: new Set(
        survivors.filter((s) => kept.includes(s.text)).map((s) => Math.floor(s.index / 2)),
      ).size,
    });
    if (rejected.length > 0) {
      console.warn('[headline/regenerate] rejected candidates', { _cid, rejected: rejected.slice(0, 5) });
    }

    if (kept.length === 0) {
      // Offering nothing is the correct outcome, not a failure to hide: every
      // option came back off-style, and showing them anyway would make the
      // button the source of bad headlines it exists to prevent.
      return NextResponse.json(
        {
          error: editorCut > 0
            ? 'Every option this time was either generic enough to run on another project or not supported by the interview. Try again, or add a note about what you want the headline to be about.'
            : `None of the options came back within house style (${HEADLINE_MAX_WORDS} words max, sentence case, nothing generic). Try again, or add a note about what you want.`,
          code: 'NO_USABLE_CANDIDATES',
        },
        { status: 422 },
      );
    }

    // Store the batch with the CURRENT headline as its first entry.
    //
    // The stored list is the pool the designer cycles, so the headline they
    // already have has to be in it — otherwise the picker has to splice it in at
    // render time, and a pool that reorders itself around whichever entry is
    // live cannot be walked (it oscillates between two). `kicker` itself is
    // untouched: the live headline does not change until they land on one.
    const pool = currentKicker ? [currentKicker, ...kept] : kept;
    blocks.lead = { ...(blocks.lead ?? {}), kickerAlternatives: pool };
    await prisma.projectPost.update({
      where: { id: post.id },
      data: { expandedBlocks: blocks as any },
    });

    return NextResponse.json({ ok: true, current: currentKicker, alternatives: pool });
  } catch (error: any) {
    if (error?.message === 'NotFound') {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    if (error?.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('[headline/regenerate] Error', { _cid, error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
