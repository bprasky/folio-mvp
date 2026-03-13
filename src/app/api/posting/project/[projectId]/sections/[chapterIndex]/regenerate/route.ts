export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { assertProjectWrite } from '@/lib/authz/access';
import { callLLM } from '@/lib/posting/llmClient';
import Anthropic from '@anthropic-ai/sdk';
import type { SectionHistoryEntry, SectionOverride } from '@/lib/posting/editingTypes';

const anthropic = new Anthropic();

const SECTION_REGEN_SYSTEM_PROMPT = `You are a senior writer for a prestigious design magazine, regenerating one section of a feature article about an interior design project.

Your writing style is warm, confident, minimalist, and design-literate. Describe process, intent, and materials poetically but concretely. Avoid marketing speak; prefer quiet authority and authenticity.

AVOID: "thoughtfully curated", "seamlessly blends", "creates a dynamic flow", "anchors the space", "adds warmth", "adds visual weight", "creates visual interest", "a sense of", generic design language.

ACCURACY: Only reference products/materials from the provided data. Do not invent quotes, vendors, or details.`;

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
    const previousBody = [...(chapter.body || [])];

    // Fetch interview answers for context
    const interview = await prisma.editorialInterview.findFirst({
      where: { projectId },
      include: { answers: true },
    });

    const answers = (interview?.answers || [])
      .filter((a: any) => a.answerText)
      .map((a: any) => `Q: ${a.questionText || 'Question'}\nA: ${a.answerText}`)
      .join('\n\n');

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
      .map((c: any) => `### ${c.title || 'Untitled'}\n${(c.body || []).join('\n\n')}`)
      .join('\n\n');

    const userPrompt = `Regenerate the body paragraphs for this section of the article. Keep the same chapter title and image selection — only rewrite the body text.

## Current Chapter
Title: ${chapter.title || 'Untitled'}
Current body:
${(chapter.body || []).join('\n\n')}

${feedback ? `## Designer's Feedback
The designer wants these changes: ${feedback}` : ''}

## Interview Responses (for context and quotes)
${answers || 'No interview data available.'}

## Products in This Section
${productsContext || 'No tagged products.'}

## Rest of the Article (for tone consistency — do NOT repeat content from these sections)
${otherChapters || 'No other sections.'}

## Instructions
- Write 2-4 paragraphs for this section
- Maintain the article's existing tone and voice
- ${feedback ? 'Address the designer\'s feedback above' : 'Provide a fresh take on this section'}
- Use designer quotes from the interview if relevant (verbatim, lightly trimmed)
- Only reference products listed above
- Return ONLY a JSON array of paragraph strings: ["paragraph 1", "paragraph 2", ...]`;

    const modelName = 'claude-sonnet-4-20250514';
    const llmResult = await callLLM(
      async () => {
        return await anthropic.messages.create({
          model: modelName,
          max_tokens: 2000,
          temperature: 0.7,
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

    // Parse the JSON array of paragraphs
    let newBody: string[];
    try {
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      if (!jsonMatch) throw new Error('No JSON array found');
      newBody = JSON.parse(jsonMatch[0]);
      if (!Array.isArray(newBody) || newBody.length === 0) throw new Error('Empty array');
      newBody = newBody.filter((p: any) => typeof p === 'string' && p.trim());
    } catch {
      // Fallback: split response into paragraphs
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

    // Clear any sectionOverrides for this chapter (text was regenerated)
    const overrides = ((post.sectionOverrides ?? []) as SectionOverride[])
      .filter((o) => o.chapterIndex !== chapterIndex);

    await prisma.projectPost.update({
      where: { id: post.id },
      data: {
        expandedBlocks: blocks as any,
        sectionHistory: history as any,
        sectionOverrides: overrides as any,
      },
    });

    return NextResponse.json({
      ok: true,
      chapter: { title: chapter.title, body: newBody, pullQuote: chapter.pullQuote },
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
