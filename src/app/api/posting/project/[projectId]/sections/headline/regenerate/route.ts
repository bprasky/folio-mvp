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
  hasWeakPredicate,
  renderFrameInstruction,
  type HeadlineFrame,
} from '@/lib/interview/prompts/headlineFrames';
import { BANNED_HEADLINE_VERBS_RULE } from '@/lib/interview/prompts/headlineVerbs';
import {
  resolveProjectHeadlineSlots,
  borrowedFragmentIsVerbatim,
} from '@/lib/posting/headlineSlots';
import {
  PROJECT_QUESTION_CATEGORIES,
  type ProjectQuestionCategory,
} from '@/lib/interview/generateProjectQuestions';
import {
  normalizeTitleAlternatives,
  type TitleAlternative,
  type TitleSelection,
} from '@/lib/posting/schemas';
import {
  normalizeHeadline,
  blockingIssues,
  headlineIssues,
  HEADLINE_MAX_WORDS,
} from '@/lib/posting/headline';
import { normalizeForVerbatimCheck } from '@/lib/posting/quoteCandidates';
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
// ── ROOM-GRAIN. NOT OFFERED ON THIS SURFACE. ─────────────────────────────────
//
// Retained, not used. These are the free-form briefs the article headline ran on
// before C3, and they are kept for the caption surface for the same reason the
// material-grain frames are kept: at room grain they are correct, and captioning a
// room is the job they were written for.
//
// They must not come back here, and the reason is precise. They carry no frame, so
// nothing constrains their grain — and the most concrete thing in this prompt is
// the article's own list of rooms. A free brief asked against that reliably returns
// "BP Design clads the Dining Room in glass": a true sentence about one room of a
// house the article covers in eight. Adding project-grain angles beside them (C2)
// did not help, because the pool still offered the shape.
//
// `check-headline-frames` asserts the article route builds its angle list from
// PROJECT_GRAIN_ANGLES alone, so wiring these back in fails a check rather than
// quietly reintroducing the bug.
const BASE_ANGLES: Array<{ key: string; brief: string }> = [
  { key: 'reversal', brief: 'A decision that could easily have gone the other way, and did not. What was nearly chosen instead?' },
  { key: 'constraint', brief: 'A limit someone had to beat — a budget, a schedule, a structural fact, a room that would not cooperate.' },
  { key: 'accident', brief: 'Something that went wrong, or arrived wrong, and was kept anyway.' },
  { key: 'client', brief: 'What the client actually asked for, in their terms, especially if it sounds unreasonable out of context.' },
  { key: 'first-move', brief: 'The one selection that set everything after it — the material or object the rest of the house had to answer to.' },
  { key: 'argument', brief: 'A claim about this project a reasonable designer could disagree with. Take a position.' },
];

/**
 * The angles this surface offers. All of them, and only these.
 *
 * An article is about a project, and the corpus puts the project in subject
 * position 41% of the time against a room's 13% (grain audit §4).
 *
 * ELIGIBILITY IS THE FRAME'S, and it is computed. Each entry appears only when
 * `eligibleFrames` returned its frame, which happens only when every one of that
 * frame's `requiredFields` resolved to a real value off a real row. There is no
 * fallback brief for any of them: an angle whose source did not resolve is not
 * asked for, and if none resolves the surface has no headline to offer rather than
 * a room-grain one.
 *
 * C2's `displaces` field is gone with the base angles it pointed at. GOVERNING-
 * DECISION superseding FIRST-MOVE is no longer a displacement between two angles in
 * one list; it is the grain gate, and it happens in `eligibleFrames`.
 */
const PROJECT_GRAIN_ANGLES: Array<{ key: string; frameId: string; needs: string; asks: string }> = [
  { key: 'constraint', frameId: 'constraint', needs: 'constraint',
    asks: 'the opening questions about the client and the scope are unanswered' },
  { key: 'governing-decision', frameId: 'governing-decision', needs: 'decision',
    asks: 'the “what was the big idea” opening question is unanswered' },
  { key: 'change', frameId: 'change', needs: 'change',
    asks: 'the “what changed along the way” opening question is unanswered' },
];

/**
 * Angles per batch, capped.
 *
 * Three project-grain frames exist, so this cannot bite today. It is kept as the
 * tripwire it was: if a fourth lands, the batch grows past what a designer can
 * usefully choose between, and this is where that gets noticed.
 */
const MAX_ANGLES = 6;

/**
 * What each opening question was actually asking, in the writer's language.
 *
 * The five "About This Project" answers are the only project-GRAIN material in the
 * interview, and they were reaching the prompt indistinguishable from a remark
 * about a bathroom faucet: a project answer has no `roomId`, so it resolved to the
 * room name "General" and was rendered `- [General] ...` beside every unassigned
 * room answer. The category was recoverable from the question id the whole time
 * and nothing was recovering it.
 *
 * Labels rather than the raw category names because `SCOPE_PARAMETERS` tells the
 * writer nothing about what the designer was answering. Typed `Record<...>` so
 * adding a sixth category fails the build here instead of silently shipping a
 * headline prompt with an unlabelled answer in it.
 */
const PROJECT_ANSWER_LABELS: Record<ProjectQuestionCategory, string> = {
  CLIENT_BRIEF: 'Who it was for, and what they asked for',
  SCOPE_PARAMETERS: 'What they were working within',
  DESIGN_DIRECTION: 'The big idea',
  SIGNATURE_IDENTITY: 'What is most recognisably theirs',
  SURPRISE_PIVOT: 'What changed along the way',
};

/**
 * Answers shown. Five categories, plus any follow-ups to them, and a follow-up is
 * where a designer stops summarising and tells you what happened — so the cap is
 * above five rather than at it.
 */
const PROJECT_ANSWERS_SHOWN = 8;

/**
 * The grain this surface publishes at.
 *
 * An article is about a project, so only project-grain frames may lead one. The
 * material-grain frames are not deleted and not weakened — they are the caption
 * layer, they stay declared and exemplar-checked in `headlineFrames.ts`, and the
 * gate is `eligibleFrames`'s, by surface. A caption surface passes 'material' here
 * and gets exactly the frames this one refuses.
 */
const SURFACE_GRAIN = 'project' as const;

/**
 * And what it may draw on.
 *
 * 'interview' is what takes CONTINUITY off this surface as well, despite its being
 * project-grain. It ranks material classes by tag count and builds a claim around
 * the winner, so it is confidently specific about whatever was photographed most
 * rather than about anything the designer emphasised — and a tag count is evidence
 * of what got photographed, not of what mattered. It stays declared, exemplar-
 * checked and tested for the caption layer, like the other three.
 */
const SURFACE_SOURCE = 'interview' as const;

/**
 * Candidates asked for, and how they are spread.
 *
 * Two per angle was right when there were always six angles. Project-grain angles
 * are computed, so a project can have one — and one angle at two candidates is a
 * batch of two, which is not a picker. The batch size is held roughly constant
 * instead and divided over however many angles resolved: three angles get four
 * each, one angle gets the cap.
 *
 * `MAX_PER_ANGLE` exists because the failure this whole structure prevents is N
 * versions of one thought. Six takes on Continuity would be that batch again, just
 * arrived at from the other direction.
 */
const TARGET_CANDIDATES = 12;
const MAX_PER_ANGLE = 4;
/** Kept. Enough to cycle without turning the arrows into a chore. */
const CANDIDATES_KEPT = 6;

const SYSTEM_PROMPT = `You are a senior writer for a prestigious design magazine, writing headline options for a feature article about an interior design project.

${FOLIO_TONE}

${HEADLINE_CRITERIA}

${EVALUATIVE_ADJECTIVES}

${BANNED_HEADLINE_VERBS_RULE}

THE SUBJECT MUST ACT. Whatever you put in front of the verb has to be the thing doing
something, not the thing something was done to. This is the single most common way a
headline goes inert, and it is invisible while you are writing it, because the
sentence still starts with the right noun.

- "A glass table was chosen to keep a dining room from crowding" — passive. The table
  does nothing; someone off-stage chose it.
- "A stone became the bathroom's anchor" — a copula. Nothing happens, a state is
  reported.
- "Styling that took more objects than the shelf could keep" — the verb has been
  demoted into a relative clause, so the subject owns no verb at all.

Write one finite active verb and give it to the subject: marble DEFINES the sinks,
terrazzo DIVIDES the room, drystone walls FRAME the house. No was, were, is, are,
became, stayed. No "that" or "which" carrying the only verb.

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
    // "More options like this one." Narrowing to one angle is what makes the button
    // mean something once the options are labelled: without it, asking for another
    // Constraint headline re-rolls all three stories and the designer loses the two
    // they were still weighing.
    const requestedAngle = typeof body?.angle === 'string' && body.angle.trim()
      ? body.angle.trim()
      : null;

    const post = await prisma.projectPost.findUnique({
      where: { projectId },
      select: { id: true, updatedAt: true, expandedBlocks: true },
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
    // Who the byline credits.
    //
    // B8 unbanned this. It used to be forbidden in the headline and enforced as
    // NAMES_PEOPLE; 57% of published design headlines open on exactly this name, so
    // the ban was killing the corpus's best-supported arrangement. It is now the
    // `agent` slot of the Agent-verb-object frame.
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
    // THE CANDIDATE SET IS THE INTERVIEW, and only its project-scoped half.
    //
    // Room answers are not read here. They are the caption layer's source, and while
    // they were in this prompt the writer kept reaching for them: the article's own
    // rooms were the most concrete thing on the page, so "BP Design clads the Dining
    // Room in glass" is what came back — a true sentence about one room of a house
    // the article covers in eight.
    //
    // `resolveProjectHeadlineSlots` issues no ProductTag read, resolves no material
    // class and reads no room name. If a material or a room reaches an article
    // headline now, it is because an answer put it there.
    const { slots, fragments, projectAnswers } = await resolveProjectHeadlineSlots(projectId);

    // Canonical question order, not the order they were saved in. The answers read
    // as an opening statement — who it was for, what the limits were, what the idea
    // was, what changed — and shuffling them costs that.
    const answerText = PROJECT_QUESTION_CATEGORIES.flatMap((c) =>
      projectAnswers.filter((a) => a.category === c),
    )
      .slice(0, PROJECT_ANSWERS_SHOWN)
      .map((a) => `- [${PROJECT_ANSWER_LABELS[a.category as ProjectQuestionCategory]}] ${toTypographicQuotes(a.answer.trim())}`)
      .join('\n');

    // The headline describes the ARTICLE, so the article is the context: what it
    // opens with, which rooms it covers, and the designer's own framing line.
    const introduction: string[] = Array.isArray(blocks.introduction) ? blocks.introduction : [];
    const hookQuote: string | null =
      typeof blocks.hookQuote?.text === 'string' ? blocks.hookQuote.text : null;
    const location = [project?.city, project?.regionState].filter(Boolean).join(', ');

    // The frame library.
    //
    // Eligibility is decided here, in code — the model is never asked whether it has
    // enough to write a given headline, because a model asked that says yes. Every
    // slot these frames need is already resolved above, from the interview and the
    // project row; nothing further is pushed on.
    //
    // Gone with the tag path: `agent` (the credited studio), `object` (the first
    // gallery chapter's room) and `verb` (the verb library, whose preconditions are
    // all tag-derived and so can no longer be answered). They belong to the
    // material-grain frames, which are the caption layer's.
    //
    // This surface HAS a deck (`blocks.lead.deck`), so deck-requiring frames are
    // eligible here. Three of the five title surfaces do not — see docs/23.

    // THIS SURFACE PUBLISHES AT PROJECT GRAIN, and says so here rather than filtering
    // downstream. An article is about a project; a material-grain frame produces a
    // true sentence about one room of a house the article covers in eight.
    const frames = eligibleFrames(slots, {
      hasDeck: true,
      grain: SURFACE_GRAIN,
      source: SURFACE_SOURCE,
    });
    const frameById = (id: string) => frames.find((f) => f.id === id) ?? null;

    // The angle list, built per project rather than declared.
    //
    // Each angle appears only if its frame came back from `eligibleFrames`, which
    // requires every one of that frame's `requiredFields` to have resolved — and for
    // these three that means a SUBSTANTIVE answer to the question behind it, not
    // merely a non-empty one. Nothing here has a fallback brief. An angle whose
    // source did not resolve is not asked for.
    const eligibleAngles = PROJECT_GRAIN_ANGLES
      .map((a) => ({ key: a.key, frame: frameById(a.frameId) }))
      .filter((a): a is { key: string; frame: HeadlineFrame } => a.frame !== null)
      .slice(0, MAX_ANGLES);
    // A requested angle narrows the batch; it cannot CREATE one. An angle whose
    // source answer never resolved is not eligible however it is asked for, which
    // keeps the one rule this surface has: never pad.
    const angles = requestedAngle
      ? eligibleAngles.filter((a) => a.key === requestedAngle)
      : eligibleAngles;

    // No project-grain angle resolved, so there is no article headline to offer.
    //
    // C2 kept a set of free-form angle briefs as the floor, and that floor was the
    // bug: unframed, they let the writer choose its own grain, and it chose the room
    // — "BP Design clads the Dining Room in glass" is what a free brief produces when
    // the article's own rooms are the most concrete thing in the prompt. Falling back
    // to a material frame here would reintroduce exactly what C3 removes, one layer
    // down.
    //
    // So the surface returns nothing and says what is missing. That is the same
    // decision the endpoint already makes when every candidate fails the rules —
    // offering nothing is a correct outcome, not a failure to hide — and it is
    // actionable in a way a bad headline is not: every one of these frames is
    // unlocked by work the designer can do (assign rooms to photos, answer the
    // opening questions, set a location).
    // A requested angle that is not eligible is a stale client, not an empty
    // project — the two produce the same `angles.length === 0` and must not produce
    // the same message. This one happens when the pool outlives the answer that fed
    // it: the label is still on screen after the designer cleared the answer behind
    // it.
    if (requestedAngle && angles.length === 0 && eligibleAngles.length > 0) {
      return NextResponse.json(
        {
          error: 'That angle is no longer available for this project. Try the other options.',
          code: 'ANGLE_NOT_ELIGIBLE',
          eligible: eligibleAngles.map((a) => a.key),
        },
        { status: 409 },
      );
    }

    if (angles.length === 0) {
      const has = (name: string) => slots.some((s) => s.name === name);
      const missing: string[] = [];
      if (!has('project'))
        missing.push('the project has no city or region set, which every project-level angle needs');
      for (const a of PROJECT_GRAIN_ANGLES) if (!has(a.needs)) missing.push(a.asks);
      console.info('[headline/regenerate] no project-grain angle is eligible', {
        _cid, projectId, resolvedSlots: slots.map((s) => s.name), missing,
      });
      return NextResponse.json(
        {
          error:
            'There is nothing to write a project-level headline from yet. ' +
            `${missing.join('; ')}.`,
          code: 'NO_ELIGIBLE_ANGLE',
          missing,
        },
        { status: 422 },
      );
    }

    // Candidates per angle, scaled so a thin project still gets a pool worth
    // cycling. Two per angle was right at six angles; at one angle it is a batch of
    // two, which is not a picker. The target is the batch size the designer was
    // already getting, spread over however many angles resolved.
    const perAngle = Math.min(MAX_PER_ANGLE, Math.ceil(TARGET_CANDIDATES / angles.length));
    const CANDIDATES_REQUESTED = angles.length * perAngle;

    // Position IS the angle: entries [i*perAngle, (i+1)*perAngle) are angles[i].
    const framesByAngle = new Map<number, HeadlineFrame>();
    angles.forEach((a, i) => framesByAngle.set(i, a.frame));


    const userPrompt = `Write ${CANDIDATES_REQUESTED} headline options for this article — ${angles.length} angle${angles.length === 1 ? '' : 's'}, ${perAngle} per angle.

## What the designer told us about this project
Their own words, from the opening questions — about the project as a whole, not
about any one room. THIS IS YOUR ONLY SOURCE MATERIAL. A headline has to come from
something in here that WAS DECIDED, WENT WRONG, WAS NEARLY DIFFERENT, or COST
SOMETHING. Not from how the finished house looks. The bracket says which question
they were answering.
${answerText}

## The project
${project?.title ? `Working title: ${project.title}` : ''}
${location ? `Location: ${location}` : ''}
${names.orgName ? `Credited to: ${names.orgName}` : names.designerName ? `Credited to: ${names.designerName}` : ''}
${fragments.length > 0 ? `
## What the designer said, word for word — QUOTABLE
Any of these may be quoted in a headline, exactly as written. They are the only
spans you may put inside quotation marks. Do not shorten, extend, tidy or re-punctuate
one, and never quote anything that is not on this list.
${fragments.slice(0, 10).map((f) => `- \u201C${f.text}\u201D`).join('\n')}
` : ''}
## Context, NOT source material
The article's own opening and its current headline are below so you do not repeat
them. Do not mine them for phrasing — they describe the finished house, and a
headline built from them will describe it too.

${introduction.length > 0 ? `Opening: ${toTypographicQuotes(introduction.join(' '))}` : '(no introduction written yet)'}
${hookQuote ? `\nThe designer's framing: “${toTypographicQuotes(hookQuote)}”` : ''}
${currentKicker ? `\nCurrent headline — do NOT repeat or paraphrase: ${toTypographicQuotes(currentKicker)}` : ''}

${feedback ? `## What the designer wants changed\n${toTypographicQuotes(feedback)}\n` : ''}
## Write ${perAngle} for each of these angles, in this order
${angles.map((a, i) => `${i * perAngle + 1}\u2013${(i + 1) * perAngle}. ${a.key.toUpperCase()} \u2014 write these ${perAngle} to the ${a.frame.name.toUpperCase()} frame below, not freely.`).join('\n')}
${Array.from(framesByAngle.values()).filter(Boolean).map((f) => `
${renderFrameInstruction(f!, slots)}
`).join('')}
Every one of these angles already HAS its source — that is why it is on this list.
Your job is to find the headline inside the words you were given, not to decide
whether there is one. Never state something the designer did not say happened, and
never name a material, a room or a brand that is not in their own words above.

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
    // angle: entry 2i and 2i+1 are the two takes on angles[i].
    const survivors: Array<{ text: string; index: number }> = [];

    raw.forEach((entry, index) => {
      if (typeof entry !== 'string') return;
      const text = normalizeHeadline(entry);
      if (!text) return;

      const key = normalizeForVerbatimCheck(text);
      if (seen.has(key)) return; // duplicate, or the headline they already have
      seen.add(key);

      // Drop on ERRORS only. TITLE_CASE is a heuristic and this pipeline documents
      // it as one — dropping on it threw away good headlines over a house
      // convention the designer can fix in the preview in two seconds. The warning
      // still travels with the candidate so it is visible rather than silent.
      const blocking = blockingIssues(text);
      if (blocking.length > 0) {
        rejected.push({ text, why: blocking.map((i) => `${i.code}: ${i.detail}`).join('; ') });
        return;
      }
      // The subject has to DO something. Every headline in the batch that prompted
      // this was a thing in subject position with the sentence reporting what
      // happened TO it — passive, a copula, or the verb demoted into a relative
      // clause. All three are ways of avoiding a finite active verb, and all three
      // read as inert.
      if (hasWeakPredicate(text)) {
        rejected.push({ text, why: 'WEAK_PREDICATE: the subject never acts — passive, copula, or verb in a relative clause' });
        return;
      }

      const warnings = headlineIssues(text).filter((i) => i.severity === 'warning');
      if (warnings.length > 0) {
        console.info('[headline/regenerate] kept with warnings', {
          _cid, text, warnings: warnings.map((i) => `${i.code}: ${i.detail}`),
        });
      }

      // Anything in quotation marks must actually have been said.
      //
      // Applied to EVERY candidate, not only the borrowed-fragment angle: the model
      // does not always keep to the position it was asked for, and a headline is the
      // worst place in the piece to attribute words to a designer that they did not
      // use. This is the same contract the pull quote pipeline holds — a quote is
      // selected, never written — checked with the same `isVerbatimSpan`.
      // ANY quote glyph, opening or closing. Testing only for openers let a
      // headline carrying a lone ” through unchecked — which is exactly what a
      // mis-stripped opening quote produces.
      if (/[\u201C\u201D"]/.test(text) && !borrowedFragmentIsVerbatim(text, projectAnswers.map((a) => a.answer))) {
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
      const rank = (i: number) => (i % perAngle) * angles.length + Math.floor(i / perAngle);
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

    // The angle rides WITH the candidate from here on.
    //
    // It was always known — position is the angle, and this block uses that fact
    // three times below — and it was dropped one line before storage when `kept`
    // mapped to `s.text`. The designer was then shown several stories as one list
    // of interchangeable strings.
    const labelled = (s: { text: string; index: number }): TitleAlternative => {
      const angle = angles[Math.floor(s.index / perAngle)];
      return { text: s.text, angle: angle?.key ?? '', angleLabel: angle?.frame.name ?? '' };
    };
    let kept: TitleAlternative[];
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
      const angleOf = (i: number) => Math.floor(i / perAngle);
      const seenAngles = new Set<number>();
      const bestPerAngle = keeps.filter((s) => {
        const a = angleOf(s.index);
        if (seenAngles.has(a)) return false;
        seenAngles.add(a);
        return true;
      });
      const rest = keeps.filter((s) => !bestPerAngle.includes(s));
      kept = [...bestPerAngle, ...rest].slice(0, CANDIDATES_KEPT).map(labelled);

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
          angle: angles[Math.floor(survivors[v.index].index / perAngle)]?.key,
          text: survivors[v.index].text,
          on: v.on ?? '(the editor did not say)',
        })),
      });
    } else {
      // No editor: ship the mechanically-clean batch in angle order rather than
      // nothing. A judgement pass that is unavailable is a reason to lose the
      // ranking, not a reason to lose the feature.
      kept = [...survivors].sort(takeOrder).slice(0, CANDIDATES_KEPT).map(labelled);
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
      surface: { grain: SURFACE_GRAIN, source: SURFACE_SOURCE },
      // Whether the project layer reached the prompt at all, and which questions
      // it came from. Zero here on a project that has been interviewed means the
      // ids are not in the `project-<CATEGORY>-<uuid>` shape the category is
      // recovered from — which is invisible in the output, because the writer
      // simply has less to work from and the headlines are merely worse.
      projectAnswers: projectAnswers.length,
      projectCategories: Array.from(new Set(projectAnswers.map((a) => a.category))),
      // Which angles had a SUBSTANTIVE source answer. An answer can be present and
      // still not clear the floor, and the two are indistinguishable from the output.
      resolvedSlots: slots.map((s) => s.name),
      tail: slots.find((s) => s.name === 'tail')?.value ?? null,
      eligible: frames.map((f) => f.id),
      quotableFragments: fragments.length,
      angles: angles.map((a) => a.key),
      perAngle,
      framedAngles: Array.from(framesByAngle.entries()).map(([i, f]) => `${angles[i].key}:${f.id}`),
      // Eligible but not asked for. Should always be empty on this surface — every
      // angle here IS its frame — so a non-empty value means the cap trimmed one,
      // which is the only way a resolved angle can go unasked.
      unboundFrames: frames
        .map((f) => f.id)
        .filter((id) => !Array.from(framesByAngle.values()).some((f) => f.id === id)),
    });

    console.info('[headline/regenerate] candidates', {
      _cid, requested: CANDIDATES_REQUESTED, returned: raw.length,
      survivedRules: survivors.length, editorCut, edited: !!verdicts,
      kept: kept.length, rejected: rejected.length,
      anglesCovered: new Set(kept.map((k) => k.angle)).size,
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
    //
    // The carried-over headline is GATED, not trusted for having been live. It used
    // to be prepended unconditionally, which was a hole the size of the whole rule
    // set: a headline written before a rule existed stayed in the pool forever,
    // re-entering on every press because it was the one currently showing. That is
    // how a passive headline outlived the check that bans it.
    //
    // Dropping it here does not strand the designer. `HeadlinePicker` splices the
    // live headline back in when the stored pool does not contain it, so it stays
    // reachable while it is live — it just stops being preserved as an OPTION once
    // they move off it, which is the correct fate for a headline that fails the
    // rules everything else in the pool had to pass.
    const carriedKicker =
      currentKicker &&
      blockingIssues(currentKicker).length === 0 &&
      !hasWeakPredicate(currentKicker)
        ? currentKicker
        : null;
    if (currentKicker && !carriedKicker) {
      console.info('[headline/regenerate] live headline dropped from the pool', {
        _cid, text: currentKicker,
      });
    }
    // A single-angle regeneration REPLACES that angle's entries and leaves the rest
    // standing. Wiping the pool would make "more Constraint options" cost the
    // Governing-decision options the designer had not looked at yet, which is the
    // slot-machine behaviour the batch model exists to avoid — one press should
    // never lose ground the designer has not rejected.
    const priorPool = normalizeTitleAlternatives((blocks.lead as any)?.kickerAlternatives);
    const survivingOther = requestedAngle
      ? priorPool.alternatives.filter((a) => a.angle !== requestedAngle)
      : [];

    // The carried headline keeps its label if the pool knew it. A headline typed by
    // hand, or one written before angles were stored, has no angle — recorded as
    // absent rather than guessed, and the picker renders it without a label.
    const carried: TitleAlternative[] = carriedKicker
      ? [
          priorPool.alternatives.find((a) => a.text === carriedKicker)
            ?? { text: carriedKicker, angle: '', angleLabel: '' },
        ]
      : [];

    const alternatives = [...carried, ...kept, ...survivingOther].filter(
      (a, i, all) => all.findIndex((b) => b.text === a.text) === i,
    );
    const selected = alternatives.find((a) => a.text === currentKicker) ?? null;
    blocks.lead = {
      ...(blocks.lead ?? {}),
      kickerAlternatives: { selected, alternatives } satisfies TitleSelection,
    };
    await prisma.projectPost.update({
      where: { id: post.id, updatedAt: post.updatedAt },
      data: { expandedBlocks: blocks as any },
    });

    return NextResponse.json({ ok: true, current: currentKicker, alternatives });
  } catch (error: any) {
    if (error?.code === 'P2025') return NextResponse.json({ error: 'The article changed. Refresh and try again.' }, { status: 409 });
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
