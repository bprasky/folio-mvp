import { stripPrivateInterviewData } from '@/lib/spotlight/privacy';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { assertProjectWrite } from '@/lib/authz/access';
import { callLLM } from '@/lib/posting/llmClient';
import Anthropic from '@anthropic-ai/sdk';
import type { SectionHistoryEntry, SectionOverride } from '@/lib/posting/editingTypes';
import { FOLIO_TONE, JSON_PROSE_QUOTING_RULE, toTypographicQuotes } from '@/lib/interview/prompts/editorialTone';
import { MODELS } from '@/lib/ai/models';
import { applyProseNamingGate } from '@/lib/naming/applyProseNamingGate';
import { cid as newCid } from '@/lib/utils/correlation';

const anthropic = new Anthropic();

const SECTION_REGEN_SYSTEM_PROMPT = `You are a senior writer for a prestigious design magazine, regenerating one section of a feature article about an interior design project.

${FOLIO_TONE}

The designer's interview answers are your primary source material — treat them the way a journalist treats quotes from a subject.

You must AVOID:
- Generic design language ("thoughtfully curated", "deliberately chosen", "seamlessly blends", "creates a dynamic flow", "transforms the space")
- These specific AI-default phrases: "anchors the space", "adds warmth", "adds visual weight", "adds [quality]", "creates intimacy", "creates visual interest", "creates a sense of", "embodies", "echoing", "the space feels", "the room feels", "without compromising", "without competing", "commitment to [abstract noun]", "testament to", "envelope of calm", "material continuity", "material palette", "a sense of [noun]", "the kind of [noun] that [clause]", "rather than [negative]" as praise by contrast
- ALSO AVOID: "reads as [noun]", "material conversation", "architectural weight" / "visual weight" / "carries weight", "metallic thread" / "thread that runs through", "burst of [noun]", "speaks quietly" / "speaks to", "restraint as strategy", "grounding the [noun]", "completing the [noun]", any aphoristic sentence that sounds like a design manifesto
- Do NOT use words like "harmonious," "curate," "elevate," "juxtaposition," or "seamlessly."

ACCURACY: Only reference products/materials from the provided data. Do not invent quotes, vendors, or details. When referencing a product, use the EXACT product name and vendor name from the tag data.`;

/**
 * POST — Regenerate a single gallery chapter with designer feedback.
 * Preserves the chapter structure (title, imageIds) but regenerates body text.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { projectId: string; chapterIndex: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { projectId } = params;
    const chapterIndex = parseInt(params.chapterIndex, 10);
    await assertProjectWrite(session.user.id, projectId);

    if (isNaN(chapterIndex) || chapterIndex < 0) {
      return NextResponse.json({ error: 'Invalid chapter index' }, { status: 400 });
    }

    const body = await request.json();
    const feedback = (body.feedback as string) || '';

    // Fetch post with current blocks
    const post = await prisma.projectPost.findUnique({
      where: { projectId },
      select: {
        id: true,
        expandedBlocks: true,
        sectionOverrides: true,
        sectionHistory: true,
        provenance: true,
      },
    });

    if (!post?.expandedBlocks) {
      return NextResponse.json({ error: 'No article to regenerate' }, { status: 404 });
    }

    const blocks = post.expandedBlocks as Record<string, any>;
    const chapters = blocks.galleryChapters as any[];

    if (!chapters || chapterIndex >= chapters.length) {
      return NextResponse.json({ error: 'Chapter not found' }, { status: 404 });
    }

    const chapter = chapters[chapterIndex];
    // Gallery chapters (photo blocks) are not editable; only editorial chapters
    // regenerate. Legacy chapters carry no `kind` and stay editable.
    if (chapter?.kind === 'gallery') {
      return NextResponse.json({ error: 'Gallery chapters are not editable' }, { status: 400 });
    }
    const previousBody = [...(chapter.body || [])];

    // Fetch designer name for quote attribution
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        designer: { select: { name: true } },
        rooms: { select: { id: true, name: true } },
      },
    });
    const designerName = project?.designer?.name || 'the designer';

    // Build room ID → name lookup
    const roomIdToName = new Map((project?.rooms || []).map(r => [r.id, r.name]));

    // Fetch interview answers — prefer answers for THIS room, include all for context
    const interview = await prisma.editorialInterview.findFirst({
      where: { projectId },
      select: {
        answers: {
          select: { questionId: true, questionText: true, answerText: true, isFollowUp: true, roomId: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    // Find the room name for this chapter (match by title).
    //
    // Whole words only. A plain `includes` matches a room name inside a longer
    // one — "Entry" inside "Entryway" — which files one room's answers under the
    // other as the PRIMARY quote source, in both directions. This is the same
    // hazard check-editorial-room-matching.ts guards in the main generator.
    const chapterTitle = ` ${(chapter.title || '').toLowerCase().replace(/[_-]+/g, ' ')} `;
    const namesThisRoom = (roomName: string): boolean =>
      chapterTitle.includes(` ${roomName.toLowerCase().replace(/[_-]+/g, ' ').trim()} `);

    // Separate answers for this room vs other rooms
    const allAnswers = (await stripPrivateInterviewData(interview?.answers || [])).filter((a: any) => a.answerText);
    const thisRoomAnswers: any[] = [];
    const otherRoomAnswers: any[] = [];

    for (const a of allAnswers) {
      const roomName = a.roomId ? roomIdToName.get(a.roomId) : undefined;
      if (roomName && namesThisRoom(roomName)) {
        thisRoomAnswers.push(a);
      } else {
        otherRoomAnswers.push(a);
      }
    }

    // Format answers with quotation marks and source tags
    const formatAnswer = (a: any) => {
      const sourceTag = a.isFollowUp
        ? '[SOURCE: FOLLOW-UP — richer narrative, prioritize for anecdotes and direct quotes]'
        : '[SOURCE: BASE QUESTION]';
      return `Q: ${a.questionText || 'Question'}\nA: “${toTypographicQuotes(a.answerText)}” ${sourceTag}`;
    };

    const thisRoomText = thisRoomAnswers.length > 0
      ? `### Interview Answers for THIS Section (${chapter.title}) — PRIMARY source for quotes:\n\n${thisRoomAnswers.map(formatAnswer).join('\n\n')}`
      : '';

    const otherRoomText = otherRoomAnswers.length > 0
      ? `### Interview Answers from Other Rooms (for context only — do not repeat their content):\n\n${otherRoomAnswers.map(formatAnswer).join('\n\n')}`
      : '';

    // The prompt below says a direct quote is MANDATORY. With no answers to quote
    // from, that is an instruction to invent one — so refuse instead of asking
    // the model to satisfy it. A section with no interview material is a gap to
    // fill in the interview, not prose to manufacture.
    if (thisRoomAnswers.length === 0 && otherRoomAnswers.length === 0) {
      return NextResponse.json(
        {
          error: 'No interview answers found for this project, so there is nothing to rewrite this section from. Add answers in the Story step first.',
          code: 'NO_ANSWERS',
        },
        { status: 422 },
      );
    }
    if (thisRoomAnswers.length === 0) {
      return NextResponse.json(
        {
          error: `No interview answers are attributed to ${chapter.title || 'this room'}, so a rewrite would have to borrow another room's words. Answer a question about this room first.`,
          code: 'NO_ROOM_ANSWERS',
        },
        { status: 422 },
      );
    }

    const answersText = [thisRoomText, otherRoomText].filter(Boolean).join('\n\n');

    // Fetch product tags for images in this chapter
    const imageIds = chapter.imageIds || [];
    const taggedProducts = imageIds.length > 0
      ? await prisma.productTag.findMany({
          where: { imageId: { in: imageIds } },
          include: { product: { include: { vendor: { select: { name: true, companyName: true } } } } },
        })
      : [];

    const productsContext = taggedProducts
      .map((t: any) => `${t.product.name}${t.product.vendor ? ` (${t.product.vendor.companyName || t.product.vendor.name})` : ''}`)
      .filter((v: string, i: number, a: string[]) => a.indexOf(v) === i)
      .join(', ');

    // Build the full article context (other chapters) for tone consistency
    const otherChapters = chapters
      .filter((_: any, i: number) => i !== chapterIndex)
      .map((c: any) => `### ${c.title || 'Untitled'}\n${toTypographicQuotes((c.body || []).join('\n\n'))}`)
      .join('\n\n');

    const userPrompt = `Regenerate the body paragraphs for this section of the article. Keep the same chapter title and image selection — only rewrite the body text.

## Current Chapter
Title: ${chapter.title || 'Untitled'}
Current body:
${toTypographicQuotes((chapter.body || []).join('\n\n'))}

${feedback ? `## Designer's Feedback
The designer wants these changes: ${toTypographicQuotes(feedback)}` : ''}

## Interview Responses — Use for Direct Quotes and Attribution
${answersText}

## Products in This Section
${productsContext || 'No tagged products.'}

## Rest of the Article (for tone consistency — do NOT repeat content from these sections)
${otherChapters || 'No other sections.'}

## WEAVING THE DESIGNER'S VOICE — MANDATORY

This section MUST include the designer's voice. The interview answers above are your primary source material.

1. DIRECT QUOTES — MANDATORY (at least 1 in this section):
   Use ${designerName}'s ACTUAL WORDS from the interview answers as a direct quote. Format naturally:
   - ${designerName} recalls... followed by a direct quote
   - As ${designerName} explains, “[quote]”
   - “[Quote],” ${designerName} says.
   Direct quotes must be REAL phrases from the interview answers. Do not invent quotes. Do not rewrite the designer's voice.

2. ATTRIBUTED PARAPHRASE (at least 1 in this section):
   Convey ${designerName}'s perspective without direct quotation:
   - ${designerName} chose brass hardware over polished nickel, drawn to its warmth...

3. UNATTRIBUTED NARRATIVE:
   The remaining prose can describe materials and spatial relationships without attribution, but should feel informed by the designer's perspective.

## Instructions
- Write 2-4 paragraphs for this section
- Maintain the article's existing tone and voice
- ${feedback ? 'Address the designer\'s feedback above' : 'Provide a fresh take on this section'}
- MANDATORY: Include at least 1 direct attributed quote from ${designerName} using their actual words from the interview
- MANDATORY: Include at least 1 attributed paraphrase
- Only reference products listed above
- Return ONLY a JSON array of paragraph strings: ["paragraph 1", "paragraph 2", ...]

${JSON_PROSE_QUOTING_RULE}`;

    const modelName = MODELS.sonnet;
    const llmResult = await callLLM(
      async () => {
        return await anthropic.messages.create({
          model: modelName,
          thinking: { type: 'disabled' },
          max_tokens: 2000,
          system: SECTION_REGEN_SYSTEM_PROMPT,
          messages: [{ role: 'user', content: userPrompt }],
        });
      },
      { modelName, contextHint: `regen:${projectId}:ch${chapterIndex}`, baseDelayMs: 500 }
    );

    if (!llmResult.ok) {
      console.error('[section/regenerate] LLM failed:', llmResult.code, llmResult.message);
      return NextResponse.json(
        { error: 'Failed to regenerate section. Please try again.' },
        { status: 502 }
      );
    }

    // Extract text from response
    const responseText = (llmResult.data as any).content
      ?.filter((b: any) => b.type === 'text')
      .map((b: any) => b.text)
      .join('') || '';

    // Parse the JSON array of paragraphs.
    //
    // The two failure modes are NOT interchangeable, so they get different
    // handling. If the model answered in plain prose with no JSON array at all,
    // splitting on blank lines is safe — there is no JSON syntax to leak into the
    // body. But if it DID return an array that fails to parse (the unescaped-quote
    // class), splitting that text splices raw JSON — trailing commas, `],`, key
    // names — into paragraphs the designer then publishes. That is exactly the
    // corruption documented in tasks/lessons.md, so we hard-fail instead.
    let newBody: string[];
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);

    if (jsonMatch) {
      try {
        const parsedBody = JSON.parse(jsonMatch[0]);
        if (!Array.isArray(parsedBody)) throw new Error('Not an array');
        newBody = parsedBody.filter((p: any) => typeof p === 'string' && p.trim());
        if (newBody.length === 0) throw new Error('No usable paragraph strings');
      } catch (parseError: any) {
        console.error('[section/regenerate] malformed JSON array — refusing to splice raw text', {
          projectId,
          chapterIndex,
          error: parseError?.message,
          rawLength: responseText.length,
        });
        return NextResponse.json(
          { error: 'The AI model returned malformed output. Please try again.' },
          { status: 502 }
        );
      }
    } else {
      newBody = responseText
        .replace(/^```json?\s*/m, '')
        .replace(/```\s*$/m, '')
        .split(/\n\n+/)
        .map((p: string) => p.replace(/^["'\s]+|["'\s]+$/g, '').trim())
        .filter(Boolean);

      if (newBody.length === 0) {
        return NextResponse.json(
          { error: 'Failed to parse regenerated content.' },
          { status: 502 }
        );
      }
    }

    // Save previous version to sectionHistory
    const history = ((post.sectionHistory ?? []) as SectionHistoryEntry[]).slice();
    const existingEntry = history.find((h) => h.chapterIndex === chapterIndex);
    if (existingEntry) {
      existingEntry.versions.push({
        body: previousBody,
        feedback: feedback || undefined,
        createdAt: new Date().toISOString(),
      });
    } else {
      history.push({
        chapterIndex,
        versions: [{
          body: previousBody,
          feedback: feedback || undefined,
          createdAt: new Date().toISOString(),
        }],
      });
    }

    // Update the chapter body in expandedBlocks
    chapters[chapterIndex].body = newBody;

    // Product Naming Gate — the same deterministic pass the full generator runs.
    // Freshly written prose can name a product whose vendor is not subscribed,
    // whether the model chose the name or lifted it from the designer's own
    // answer. Skipping it here made one button press a way around a commercial
    // gate. Run over the whole blocks: the scrub leaves eligible names alone, so
    // re-running it on untouched chapters is a no-op.
    const _cid = newCid('section-regen');
    const allProductIds = (
      await prisma.productTag.findMany({
        where: { image: { projectId } },
        select: { productId: true },
      })
    ).map((t) => t.productId);

    const gatedBlocks = await applyProseNamingGate(blocks as any, {
      productIds: allProductIds,
      projectId,
      postingUserId: session.user.id,
      cid: _cid,
      source: 'section-regenerate',
    });
    // The gate may have rewritten the body it was handed; persist and return
    // what it produced, never the pre-gate text.
    const gatedChapters = (gatedBlocks as any).galleryChapters as any[];
    const savedBody: string[] = gatedChapters?.[chapterIndex]?.body ?? newBody;

    // Clear any sectionOverrides for this chapter (text was regenerated)
    const overrides = ((post.sectionOverrides ?? []) as SectionOverride[])
      .filter((o) => o.chapterIndex !== chapterIndex);

    await prisma.projectPost.update({
      where: { id: post.id },
      data: {
        expandedBlocks: gatedBlocks as any,
        sectionHistory: history as any,
        sectionOverrides: overrides as any,
      },
    });

    return NextResponse.json({
      ok: true,
      chapter: { title: chapter.title, body: savedBody, pullQuote: chapter.pullQuote },
      previousBody,
    });
  } catch (error: any) {
    if (error.message === 'NotFound') {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    if (error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('[section/regenerate] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
