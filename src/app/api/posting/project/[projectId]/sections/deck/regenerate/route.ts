export const dynamic = 'force-dynamic';

/**
 * POST — Rewrite the deck to sit under the title the designer just chose.
 *
 * The deck and the kicker used to come out of one call, as two keys of one `lead`
 * object in `generateEditorialDraft`. That is correct exactly once: at draft time
 * they agree because they were written together. The moment the designer picks a
 * different title — a different ANGLE, since P1 — the deck is still the one written
 * to sit under the headline they rejected.
 *
 * `frozenLead` already solved the general version of this: a designer-edited lead
 * field is passed to the generator as FIXED context so the unfrozen field is
 * written to fit it. What was missing was a cheap trigger — the only consumer of
 * `frozenLead` is a full article regeneration, which rewrites every chapter to
 * update one sentence. This is that trigger, and nothing more: fixed title in, one
 * deck out.
 *
 * Deliberately NOT a generator. It writes no headline, touches no chapter, and
 * reads the same interview the title was written from — so the deck cannot
 * introduce a fact the title's own source did not contain.
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
  toTypographicQuotes,
} from '@/lib/interview/prompts/editorialTone';
import { HEADLINE_FRAMES } from '@/lib/interview/prompts/headlineFrames';
import { resolveProjectHeadlineSlots } from '@/lib/posting/headlineSlots';
import {
  PROJECT_QUESTION_CATEGORIES,
  type ProjectQuestionCategory,
} from '@/lib/interview/generateProjectQuestions';

const anthropic = new Anthropic();

/** Mirrors the headline route's labels — the same questions, the same words. */
const PROJECT_ANSWER_LABELS: Record<ProjectQuestionCategory, string> = {
  CLIENT_BRIEF: 'Who it was for, and what they asked for',
  SCOPE_PARAMETERS: 'What they were working within',
  DESIGN_DIRECTION: 'The big idea',
  SIGNATURE_IDENTITY: 'What is most recognisably theirs',
  SURPRISE_PIVOT: 'What changed along the way',
};

/** `BlocksSchema` caps the deck at 400. */
const DECK_MAX_CHARS = 400;

export async function POST(
  request: NextRequest,
  { params }: { params: { projectId: string } },
) {
  const _cid = newCid('deck-regen');
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { projectId } = params;
    await assertProjectWrite(session.user.id, projectId);

    const body = await request.json().catch(() => ({}));
    const requestedTitle = typeof body?.title === 'string' ? body.title.trim() : '';
    const angleId = typeof body?.angle === 'string' ? body.angle.trim() : '';

    const post = await prisma.projectPost.findUnique({
      where: { projectId },
      select: { id: true, expandedBlocks: true },
    });
    if (!post?.expandedBlocks) {
      return NextResponse.json({ error: 'No article to write a deck for' }, { status: 404 });
    }
    const blocks = post.expandedBlocks as Record<string, any>;

    // The title the deck must sit under. The request may name it — the picker sends
    // the option it just saved — but the stored `kicker` is authoritative, because
    // it is what the page renders. They differ only if a save failed, and in that
    // case writing a deck for a title nobody has is the wrong outcome.
    const title: string = blocks.lead?.kicker ?? blocks.lead?.title ?? requestedTitle;
    if (!title.trim()) {
      return NextResponse.json(
        { error: 'Pick a title first — the deck is written to sit under it.', code: 'NO_TITLE' },
        { status: 409 },
      );
    }

    // The same source the title came from. A deck drawn from anything wider could
    // introduce a fact the title's own angle never had access to, which is the
    // disagreement this endpoint exists to remove.
    const { projectAnswers } = await resolveProjectHeadlineSlots(projectId);
    const answerText = PROJECT_QUESTION_CATEGORIES.flatMap((c) =>
      projectAnswers.filter((a) => a.category === c),
    )
      .slice(0, 8)
      .map((a) => `- [${PROJECT_ANSWER_LABELS[a.category as ProjectQuestionCategory]}] ${toTypographicQuotes(a.answer.trim())}`)
      .join('\n');

    if (!answerText) {
      return NextResponse.json(
        { error: 'There are no project-level answers to write a deck from yet.', code: 'NO_SOURCE' },
        { status: 422 },
      );
    }

    // What the title is ABOUT, named. The deck's job is to do something the
    // headline did not, and knowing which angle the headline took is what makes
    // "something else" a decidable instruction rather than a hope.
    const frame = HEADLINE_FRAMES.find((f) => f.id === angleId) ?? null;

    const prompt = `${FOLIO_TONE}

${EVALUATIVE_ADJECTIVES}

Write the DECK for an article whose headline is already chosen and FIXED.

## The headline — reproduce nothing from it
${toTypographicQuotes(title)}
${frame ? `\nIt was written to this angle: ${frame.name.toUpperCase()} — ${frame.tailRule}\n` : ''}
## What the designer told us about this project
Their own words, from the opening questions. This is your only source material.
${answerText}

## What a deck is
${HEADLINE_CRITERIA}

The rule that matters most here: DIVIDE THE WORK. The headline above already made
its one claim.${frame ? ` It made it as ${frame.name.toLowerCase()}.` : ''} The deck
must do something it did NOT — the evidence, the stakes, or the specifics. If the
deck restates the headline in longer words, both are wasted.

One or two sentences. Under ${DECK_MAX_CHARS} characters. Never state something the
designer did not say happened, and never name a material, a room or a brand that is
not in their own words above.

Return ONLY the deck text. No quotation marks around it, no preamble, no JSON.`;

    const llm = await callLLM(
      async () =>
        anthropic.messages.create({
          model: MODELS.sonnet,
          max_tokens: 400,
          messages: [{ role: 'user', content: prompt }],
        }),
      { modelName: MODELS.sonnet, contextHint: `deck:${projectId}` },
    );

    if (!llm.ok) {
      // A stale deck is what the designer already had. Failing loudly here would
      // undo nothing and fix nothing, so it reports and leaves the deck alone.
      console.warn('[deck/regenerate] llm failed; deck left as it was', { _cid, projectId });
      return NextResponse.json(
        { error: 'Could not write a new deck. The previous one is unchanged.', code: 'LLM_FAILED' },
        { status: 503 },
      );
    }

    const first = llm.data.content.find((c: any) => c.type === 'text');
    const raw = first && 'text' in first ? (first.text as string) : '';
    const deck = toTypographicQuotes(
      raw.trim().replace(/^["“'‘]+/, '').replace(/["”'’]+$/, '').trim(),
    ).slice(0, DECK_MAX_CHARS);

    if (!deck) {
      return NextResponse.json(
        { error: 'Could not write a new deck. The previous one is unchanged.', code: 'EMPTY' },
        { status: 503 },
      );
    }

    const previous: string = blocks.lead?.deck ?? '';
    blocks.lead = { ...(blocks.lead ?? {}), deck };
    await prisma.projectPost.update({
      where: { id: post.id },
      data: { expandedBlocks: blocks as any },
    });

    console.info('[deck/regenerate] rewritten to fit the chosen title', {
      _cid, projectId, angle: angleId || null, title, deck, previous,
    });

    return NextResponse.json({ ok: true, deck });
  } catch (error: any) {
    if (error?.message === 'NotFound') {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    if (error?.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('[deck/regenerate] Error', { _cid, error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
