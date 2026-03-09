export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import { prisma } from "@/lib/prisma";
import { assertProjectWrite } from "@/lib/authz/access";
import { callLLM } from "@/lib/posting/llmClient";
import { ensureUnder, summarizeBudget } from "@/lib/posting/contextBudget";
import { compactImages, compactProducts, softModerate } from "@/lib/posting/promptBuilders";
import { cid } from "@/lib/utils/correlation";
import { z } from "zod";
import { randomUUID } from "crypto";

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const BatchFollowUpRequestSchema = z.object({
  roomId: z.string(),
  roomName: z.string(),
  roomTags: z.array(z.object({
    name: z.string(),
    vendor: z.string().optional(),
  })).optional(),
  previousAnswers: z.array(z.object({
    question: z.string(),
    answer: z.string(),
  })),
  round: z.number().int().min(1).max(3),
  maxFollowUps: z.number().int().min(1).max(5),
});

// ---------------------------------------------------------------------------
// Feature flags
// ---------------------------------------------------------------------------

const POSTING_V1_ENABLED =
  (process.env.POSTING_V1 ?? "").toLowerCase() === "true" ||
  (process.env.NEXT_PUBLIC_POSTING_V1 ?? "").toLowerCase() === "true" ||
  process.env.NODE_ENV !== "production";

// ---------------------------------------------------------------------------
// System prompt — dedicated follow-up prompt (NOT the editorial system prompt)
// ---------------------------------------------------------------------------

const BATCH_FOLLOWUP_SYSTEM_PROMPT = `You are interviewing a designer about their project for a design magazine feature. Based on the designer's answers to the previous round of questions, generate follow-up questions that dig deeper into the most interesting and story-rich aspects of what they shared.

RULES:
- Reference specific things the designer said. Not generic questions.
- Chase stories: if they mentioned changing their mind, ask what the original choice was. If they mentioned a compromise, ask what the client wanted vs what they wanted.
- Chase details: if they mentioned a specific product, ask why that one and what they considered instead.
- Chase emotion: if they expressed pride or frustration, go there.
- Do NOT ask questions that could be answered by looking at photos.
- Do NOT ask generic design questions unrelated to what they said.
- Each question should start with a reference to their answer: "You mentioned [X]..." or "You said [X]..." or "Tell me more about [X]..."
- Keep each question under 200 characters.
- Each follow-up must be distinct — do not ask the same question twice from different angles.

Return a JSON object with:
{
  "followUps": [
    { "question": "string", "triggerAnswer": "string (brief excerpt of which answer inspired this)" }
  ]
}

Generate exactly the number of follow-ups requested. If the answers don't contain enough interesting threads, generate fewer rather than generic questions.`;

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  const _cid = cid('followups-batch');
  try {
    if (!POSTING_V1_ENABLED) {
      return NextResponse.json({ error: "posting_disabled" }, { status: 404 });
    }

    console.info('[followups-batch] start', { _cid, projectId: params.projectId });
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const projectId = params.projectId;

    // Check project write access
    try {
      await assertProjectWrite(session.user.id, projectId);
    } catch (e: any) {
      if (e.message === "NotFound") {
        return NextResponse.json({ error: "Project not found" }, { status: 404 });
      }
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Validate input
    const body = await request.json();
    let validated;
    try {
      validated = BatchFollowUpRequestSchema.parse(body);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return NextResponse.json(
          { error: "validation_failed", issues: err.issues },
          { status: 422 }
        );
      }
      throw err;
    }

    if (validated.previousAnswers.length === 0) {
      return NextResponse.json(
        { ok: true, followUps: [], _cid },
        { status: 200 }
      );
    }

    // Fetch project context
    const projectData = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        title: true,
        city: true,
        regionState: true,
        projectType: true,
        images: {
          select: {
            id: true,
            name: true,
            url: true,
            room: true,
            tags: {
              select: {
                product: {
                  select: {
                    id: true,
                    name: true,
                    vendor: { select: { name: true } },
                  },
                },
              },
            },
          },
          take: 12,
          orderBy: { createdAt: "desc" },
        },
      },
    });

    // Build images and products context
    const imagesCompact = compactImages(
      (projectData?.images || []).map((img) => ({
        id: img.id,
        name: img.name ?? undefined,
        url: img.url,
        room: (img.room as string) ?? undefined,
        tags: (img.tags || []).map((t: any) => ({
          productName: t.product?.name ?? undefined,
          vendorName: t.product?.vendor?.name ?? undefined,
        })),
      }))
    );

    const taggedProducts = (projectData?.images || [])
      .flatMap((img) =>
        (img.tags || []).map((t: any) => ({
          id: t.product?.id,
          name: t.product?.name,
          vendor: t.product?.vendor?.name,
          key: t.product?.id || null,
        }))
      );
    const productsCompact = compactProducts(taggedProducts, 16);

    // Build user prompt
    let prompt = `Project: ${projectData?.title || "Untitled"}`;
    if (projectData?.city || projectData?.regionState) {
      prompt += ` (${projectData.city || projectData.regionState})`;
    }
    if (projectData?.projectType) {
      prompt += `\nType: ${projectData.projectType}`;
    }

    prompt += `\nRoom: ${validated.roomName}`;
    prompt += `\nRound: ${validated.round} (${validated.round === 1 ? 'first follow-up round' : 'deep follow-up round'})`;

    // Designer's answers from the previous round
    prompt += `\n\nDesigner's answers from this room:\n`;
    for (const qa of validated.previousAnswers) {
      const moderated = softModerate(`${qa.question}: ${qa.answer}`);
      prompt += `\nQ: ${qa.question}\nA: ${moderated.text.split(': ').slice(1).join(': ') || qa.answer}\n`;
    }

    // Room tags
    if (validated.roomTags?.length) {
      prompt += `\nTagged products in this room:\n`;
      for (const tag of validated.roomTags) {
        prompt += `- ${tag.name}${tag.vendor ? ` (${tag.vendor})` : ''}\n`;
      }
    }

    // Additional context from images/products
    if (imagesCompact.trim()) {
      prompt += `\nProject images context:\n${imagesCompact}`;
    }
    if (productsCompact.trim()) {
      prompt += `\n${productsCompact}`;
    }

    prompt += `\n\nGenerate exactly ${validated.maxFollowUps} follow-up question${validated.maxFollowUps > 1 ? 's' : ''} that dig deeper into the most interesting aspects of what the designer shared.`;

    // Enforce token budget
    const MAX_TOKENS = 4000;
    prompt = ensureUnder(prompt, MAX_TOKENS);

    const budget = summarizeBudget({
      system: BATCH_FOLLOWUP_SYSTEM_PROMPT,
      user: prompt,
      full: `${BATCH_FOLLOWUP_SYSTEM_PROMPT}\n\n${prompt}`,
    });
    console.info('[followups-batch] budget(tokens)', { _cid, budget });

    // Call LLM
    const modelName = 'claude-sonnet-4-20250514';

    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const anthropic = new Anthropic();

    const llmResult = await callLLM(
      async () => {
        return await anthropic.messages.create({
          model: modelName,
          system: BATCH_FOLLOWUP_SYSTEM_PROMPT,
          messages: [{ role: "user", content: prompt }],
          temperature: 0.7,
          max_tokens: 500,
        });
      },
      { modelName, contextHint: `followups-batch:${projectId}:${validated.roomId}` }
    );

    if (!llmResult.ok) {
      console.warn('[FOLLOWUP_ERROR] batch llm_failed', { _cid, code: llmResult.code });
      return NextResponse.json(
        { ok: true, followUps: [], _cid },
        { status: 200 }
      );
    }

    console.info('[followups-batch] llm_ok', { _cid, model: llmResult.usedModel });

    // Parse response
    const rawText = llmResult.data.content[0]?.type === 'text' ? llmResult.data.content[0].text : '{}';
    const raw = rawText.replace(/```json\n?|\n?```/g, '').trim();
    let json: any;
    try {
      json = JSON.parse(raw);
    } catch (parseErr) {
      console.error('[FOLLOWUP_ERROR] batch json_parse_failed', { _cid, raw: raw.slice(0, 200), parseErr });
      return NextResponse.json(
        { ok: true, followUps: [], _cid },
        { status: 200 }
      );
    }

    // Extract and validate follow-ups
    const followUpsRaw: Array<{ question: string; triggerAnswer?: string }> = Array.isArray(json.followUps)
      ? json.followUps.filter(
          (fu: any) => typeof fu.question === 'string' && fu.question.trim().length > 0 && fu.question.length <= 250
        )
      : [];

    const followUps = followUpsRaw.slice(0, validated.maxFollowUps).map((fu) => ({
      id: `fu-batch-${validated.roomId}-${randomUUID().slice(0, 8)}`,
      question: fu.question.trim(),
      roomId: validated.roomId,
      triggerAnswer: typeof fu.triggerAnswer === 'string' ? fu.triggerAnswer.slice(0, 200) : undefined,
    }));

    console.info('[followups-batch] result', {
      _cid,
      roomName: validated.roomName,
      round: validated.round,
      requested: validated.maxFollowUps,
      generated: followUps.length,
    });

    // Persist to provenance (non-blocking)
    try {
      const freshPost = await prisma.projectPost.findUnique({
        where: { projectId },
        select: { provenance: true },
      });

      if (freshPost) {
        const freshProvenance = (freshPost.provenance as any) || {};
        const freshInterview = { ...(freshProvenance.interview || {}) };
        const existingFollowUps = freshInterview.followUps || [];

        const batchKey = `batch-${validated.roomId}-r${validated.round}`;
        const filtered = existingFollowUps.filter(
          (group: any) => group.questionId !== batchKey
        );
        const newGroup = {
          questionId: batchKey,
          followUps: followUps.map((fu) => ({
            id: fu.id,
            prompt: fu.question,
          })),
        };

        freshInterview.followUps = [...filtered, newGroup];

        await prisma.projectPost.update({
          where: { projectId },
          data: {
            provenance: {
              ...freshProvenance,
              interview: freshInterview,
            },
          },
        });
      }
    } catch (persistError) {
      console.warn("[followups-batch] Failed to persist (non-blocking):", persistError);
    }

    return NextResponse.json(
      { ok: true, followUps, _cid },
      { status: 200 }
    );
  } catch (error: any) {
    if (error.name === "ZodError") {
      return NextResponse.json(
        { error: "validation_failed", issues: error.errors },
        { status: 422 }
      );
    }
    if (error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const requestId = randomUUID();
    console.error("[FOLLOWUP_ERROR] batch unhandled", { requestId, error: error?.message || error });
    // Degrade gracefully — follow-ups are an enhancement, not a gate
    return NextResponse.json(
      { ok: true, followUps: [], requestId },
      { status: 200 }
    );
  }
}
