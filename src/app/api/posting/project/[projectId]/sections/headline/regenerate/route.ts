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

const anthropic = new Anthropic();

/**
 * Asked for. Well over what we keep, because the filter is strict — length,
 * sentence case, seven banned shapes, and the designer's own name — and a batch
 * that comes back mostly rejected should still fill the pool.
 */
const CANDIDATES_REQUESTED = 12;
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

    // The headline describes the ARTICLE, so the article is the context: what it
    // opens with, which rooms it covers, and the designer's own framing line.
    const introduction: string[] = Array.isArray(blocks.introduction) ? blocks.introduction : [];
    const chapterTitles: string[] = (Array.isArray(blocks.galleryChapters) ? blocks.galleryChapters : [])
      .map((c: any) => c?.title)
      .filter((t: any): t is string => typeof t === 'string' && !!t.trim());
    const hookQuote: string | null =
      typeof blocks.hookQuote?.text === 'string' ? blocks.hookQuote.text : null;
    const location = [project?.city, project?.regionState].filter(Boolean).join(', ');

    const userPrompt = `Write ${CANDIDATES_REQUESTED} different headline options for this article.

## The project
${project?.title ? `Working title: ${project.title}` : ''}
${location ? `Location: ${location}` : ''}
${names.orgName ? `Credited to: ${names.orgName}` : names.designerName ? `Credited to: ${names.designerName}` : ''} — do NOT name them in the headline
Rooms covered: ${chapterTitles.length > 0 ? chapterTitles.join(', ') : 'unspecified'}

## How the article currently opens
${introduction.length > 0 ? toTypographicQuotes(introduction.join('\n\n')) : '(no introduction written yet)'}

${hookQuote ? `## The designer's own framing, in their words\n“${toTypographicQuotes(hookQuote)}”` : ''}

${currentKicker ? `## The current headline — do NOT repeat it, and do not paraphrase it\n${toTypographicQuotes(currentKicker)}` : ''}

${feedback ? `## What the designer wants changed\n${toTypographicQuotes(feedback)}` : ''}

Give ${CANDIDATES_REQUESTED} genuinely DIFFERENT options — different angles on the project, not one headline reworded ${CANDIDATES_REQUESTED} ways. Each must satisfy every rule above.

Return ONLY a JSON array of strings.`;

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
    const kept: string[] = [];

    for (const entry of raw) {
      if (typeof entry !== 'string') continue;
      const text = normalizeHeadline(entry);
      if (!text) continue;

      const key = normalizeForVerbatimCheck(text);
      if (seen.has(key)) continue; // duplicate, or the headline they already have
      seen.add(key);

      const issues = headlineIssues(text, names);
      if (issues.length > 0) {
        rejected.push({ text, why: issues.map((i) => `${i.code}: ${i.detail}`).join('; ') });
        continue;
      }
      kept.push(text);
      if (kept.length >= CANDIDATES_KEPT) break;
    }

    console.info('[headline/regenerate] candidates', {
      _cid, requested: CANDIDATES_REQUESTED, returned: raw.length, kept: kept.length, rejected: rejected.length,
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
