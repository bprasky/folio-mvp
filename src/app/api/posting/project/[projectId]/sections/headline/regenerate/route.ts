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
  FOLIO_TONE,
  HEADLINE_CRITERIA,
  JSON_PROSE_QUOTING_RULE,
  toTypographicQuotes,
} from '@/lib/interview/prompts/editorialTone';
import {
  normalizeHeadline,
  headlineIssues,
  HEADLINE_MAX_WORDS,
} from '@/lib/posting/headline';
import { normalizeForVerbatimCheck } from '@/lib/posting/quoteCandidates';
import { loadInterviewAnswers } from '@/lib/posting/loadInterviewAnswers';

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

## Context, NOT source material
The article's own opening and its current headline are below so you do not repeat
them. Do not mine them for phrasing — they describe the finished house, and a
headline built from them will describe it too.

${introduction.length > 0 ? `Opening: ${toTypographicQuotes(introduction.join(' '))}` : '(no introduction written yet)'}
${hookQuote ? `\nThe designer's framing: “${toTypographicQuotes(hookQuote)}”` : ''}
${currentKicker ? `\nCurrent headline — do NOT repeat or paraphrase: ${toTypographicQuotes(currentKicker)}` : ''}

${feedback ? `## What the designer wants changed\n${toTypographicQuotes(feedback)}\n` : ''}
## Write two for each of these angles, in this order
${ANGLES.map((a, i) => `${i * 2 + 1}. and ${i * 2 + 2}. ${a.key.toUpperCase()} — ${a.brief}`).join('\n')}

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
    const kept = [...survivors].sort(takeOrder).slice(0, CANDIDATES_KEPT).map((s) => s.text);

    console.info('[headline/regenerate] candidates', {
      _cid, requested: CANDIDATES_REQUESTED, returned: raw.length, kept: kept.length, rejected: rejected.length,
      anglesCovered: new Set(survivors.slice(0, CANDIDATES_KEPT).map(s => Math.floor(s.index / 2))).size,
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
          error: `None of the options came back within house style (${HEADLINE_MAX_WORDS} words max, sentence case, nothing generic). Try again, or add a note about what you want.`,
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
