import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import { prisma } from "@/lib/prisma";
import { assertProjectView } from "@/lib/authz/access";
import { normalizeRole } from "@/lib/permissions";
import { normalizeAnswers, makeAnswerKey } from "@/lib/posting/interviewSchemas";
import { moderateAnswers } from "@/lib/posting/moderation";
import { callLLM } from "@/lib/posting/llmClient";
import { approxTokens, summarizeBudget, ensureUnder } from "@/lib/posting/contextBudget";
import { compactImages, compactProducts, softModerate } from "@/lib/posting/promptBuilders";
import { cid } from "@/lib/utils/correlation";
import { z } from "zod";
import { randomUUID } from "crypto";

// Cache last good follow-ups per question (dev/runtime only)
const lastGoodFollowups = new Map<string, Array<{ id: string; prompt: string }>>();

const SingleFollowUpRequestSchema = z.object({
  questionId: z.string(),
  answer: z.string(),
});

const POSTING_V1_ENABLED =
  (process.env.POSTING_V1 ?? "").toLowerCase() === "true" ||
  process.env.NODE_ENV !== "production";
const OPENAI_ENABLED =
  !!process.env.OPENAI_API_KEY && process.env.OPENAI_ENABLED !== "false";

const SYSTEM_PROMPT = `You are an editorial interviewer for Folio. Based on the designer's answer below, suggest up to two open-ended follow-up questions that could draw out a richer narrative. Only ask when something is interesting or vague. Keep each under 120 characters. Do not repeat or rephrase the original question.

Optionally, provide a brief acknowledgment sentence (1-2 sentences, under 150 characters) that naturally transitions to the follow-up questions. This should feel conversational and acknowledge what the designer shared. Examples:
- "That's interesting. Could you tell me more about..."
- "Thanks for sharing that. I'm curious about..."
- "That sounds important. What led you to..."

Return a JSON object with:
- acknowledgment: string (optional, 1-2 sentences transitioning to follow-ups)
- followUps: array of { id: string, prompt: string }

Only include follow-ups if the answer would benefit from deeper exploration. Skip if the answer is already rich and complete. The acknowledgment is optional but encouraged when follow-ups are provided.

Example format:
{
  "acknowledgment": "That's interesting. Could you tell me more about how that decision shaped the final design?",
  "followUps": [
    { "id": "fu-1", "prompt": "What made that direction feel right emotionally?" },
    { "id": "fu-2", "prompt": "How did that decision impact the final design?" }
  ]
}`;

export async function POST(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  const _cid = cid('followups-single');
  try {
    if (!POSTING_V1_ENABLED) {
      return NextResponse.json(
        { error: "posting_disabled" },
        { status: 404 }
      );
    }

    console.info('[followups-single] start', { _cid, projectId: params.projectId });
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const projectId = params.projectId;
    const role = normalizeRole(session?.user?.role);

    // Check project access
    await assertProjectView(session.user.id, projectId);

    // Verify role permission
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { ownerId: true, designerId: true },
    });

    if (!project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }

    const isOwner = project.ownerId === session.user.id || project.designerId === session.user.id;
    if (!isOwner && role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Validate input
    const body = await request.json();
    let validated;
    try {
      validated = SingleFollowUpRequestSchema.parse(body);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return NextResponse.json(
          { error: "validation_failed", issues: err.issues },
          { status: 422 }
        );
      }
      throw err;
    }

    if (!validated.answer || validated.answer.trim().length === 0) {
      return NextResponse.json(
        { ok: false, error: "invalid_body", message: "answer is required and must not be empty" },
        { status: 422 }
      );
    }

    // Fetch project context for richer prompts
    const projectData = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        title: true,
        description: true,
        city: true,
        regionState: true,
        projectType: true,
        images: {
          select: {
            id: true,
            name: true,
            url: true,
            tags: {
              select: {
                product: {
                  select: {
                    id: true,
                    name: true,
                    vendor: {
                      select: {
                        name: true,
                      },
                    },
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

    // Normalize answer
    const normalizedAnswer = normalizeAnswers([
      {
        questionId: validated.questionId,
        answer: validated.answer,
        role: "DESIGNER" as const,
      }
    ])[0];

    if (!normalizedAnswer) {
      return NextResponse.json(
        { ok: false, error: "invalid_body", message: "Could not normalize answer" },
        { status: 422 }
      );
    }

    // Soft moderation (non-blocking)
    try {
      const mod = await moderateAnswers([
        {
          questionId: validated.questionId,
          answer: validated.answer,
        }
      ]);
      if (mod.flagged) {
        console.warn("[followups-single] Moderation flagged answer:", mod.fields);
      }
    } catch (modError) {
      console.warn("[followups-single] Moderation failed (non-blocking):", modError);
    }

    // If OpenAI not available, return explicit error
    if (!OPENAI_ENABLED) {
      console.warn('[followups-single] LLM disabled/unavailable');
      // Check cache before returning error
      const cacheKey = `${projectId}:${validated.questionId}`;
      const cached = lastGoodFollowups.get(cacheKey);
      if (cached?.length) {
        console.warn('[followups-single] LLM unavailable; serving cached followups');
        return NextResponse.json({ ok: true, followups: cached, _cid }, { status: 200 });
      }
      return NextResponse.json(
        { ok: false, followups: [], error: 'llm_unavailable' },
        { status: 503 }
      );
    }

    // Build compact context
    const images = projectData?.images || [];
    const imagesCompact = compactImages(
      images.map((img) => ({ id: img.id, alt: img.name, caption: img.name })),
      12
    );

    // Extract tagged products from images
    const allTags = images.flatMap((img) => (img as any).tags || []);
    const taggedProducts = allTags
      .map((tag: any) => tag?.product)
      .filter((p: any) => p)
      .map((p: any) => ({
        name: p.name || 'Product',
        vendor: p.vendor?.name || null,
        url: null,
        key: p.id || null,
      }));
    const productsCompact = compactProducts(taggedProducts, 16);

    // Build prompt for single answer
    const answerText = `[${validated.questionId}]: ${normalizedAnswer.answer}`;
    const moderated = softModerate(answerText);
    if (moderated.changed) {
      console.info('[followups-single] softModerated answer', { _cid });
    }

    // Build user prompt
    let prompt = `Project: ${projectData?.title || "Untitled"}`;
    if (projectData?.city || projectData?.regionState) {
      prompt += ` (${projectData.city || projectData.regionState})`;
    }
    if (projectData?.projectType) {
      prompt += `\nType: ${projectData.projectType}`;
    }
    prompt += `\n\nDesigner's answer:\n${moderated.text}`;
    
    if (imagesCompact.trim()) {
      prompt += `\n\nContext:\n${imagesCompact}`;
    }
    if (productsCompact.trim()) {
      prompt += `\n${productsCompact}`;
    }
    
    prompt += `\n\nGenerate 0-2 follow-up questions that would help draw out a richer narrative from this answer. Only ask when something is interesting or vague. Keep each under 120 characters.`;

    // Enforce budget
    const MAX_TOKENS = 4000;
    prompt = ensureUnder(prompt, MAX_TOKENS);

    // Check prompt budget and log
    const budget = summarizeBudget({ system: SYSTEM_PROMPT, user: prompt, full: `${SYSTEM_PROMPT}\n\n${prompt}` });
    console.info('[followups-single] budget(tokens)', { _cid, budget });

    // Call OpenAI with LLM client wrapper
    const modelName = process.env.OPENAI_MODEL || 'gpt-4o-mini';
    
    if (!/gpt|o\d|4|mini|omni/i.test(modelName)) {
      console.warn('[followups-single] suspicious model name', { modelName, _cid });
    }
    
    const openai = await import("openai").then((m) =>
      new m.default({ apiKey: process.env.OPENAI_API_KEY })
    );

    const llmResult = await callLLM(
      async () => {
        return await openai.chat.completions.create(
          {
            model: modelName,
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              { role: "user", content: prompt },
            ],
            temperature: 0.7,
            max_tokens: 300,
            response_format: { type: "json_object" },
          }
        );
      },
      { modelName, contextHint: `followups-single:${projectId}:${validated.questionId}` }
    );

    if (!llmResult.ok) {
      console.error('[followups-single] llm_fail', {
        _cid,
        code: llmResult.code,
        status: llmResult.status,
        msg: llmResult.message,
      });
      
      // Check cache before returning error
      const cacheKey = `${projectId}:${validated.questionId}`;
      const cached = lastGoodFollowups.get(cacheKey);
      if (cached?.length) {
        console.warn('[followups-single] llm_fail; serving cached followups', { _cid });
        return NextResponse.json({ ok: true, followups: cached, _cid }, { status: 200 });
      }
      
      const status =
        llmResult.code === 'auth_failed'
          ? 401
          : llmResult.code === 'rate_limited'
          ? 429
          : llmResult.code === 'timeout'
          ? 408
          : llmResult.code === 'moderation_block'
          ? 422
          : 502;
      return NextResponse.json(
        { ok: false, followups: [], error: llmResult.code },
        { status }
      );
    }

    console.info('[followups-single] llm_ok', { _cid, model: llmResult.usedModel });

    const raw = llmResult.data.choices?.[0]?.message?.content || "{}";
    const json = JSON.parse(raw);

    // Extract acknowledgment (optional)
    const acknowledgment = typeof json.acknowledgment === "string" 
      ? json.acknowledgment.trim().slice(0, 150) 
      : undefined;

    // Validate response structure
    let followUpsRaw: Array<{ id: string; prompt: string }> = [];

    let followUpsArray = json.followUps;
    if (!Array.isArray(followUpsArray)) {
      followUpsArray = [];
    }

    if (Array.isArray(followUpsArray)) {
      followUpsRaw = followUpsArray
        .map((fu: any) => ({
          id:
            fu?.id ||
            `fu-${validated.questionId}-${Math.random()
              .toString(36)
              .slice(2, 11)}`,
          prompt: typeof fu?.prompt === "string" ? fu.prompt.trim() : "",
        }))
        .filter((fu: any) => {
          return fu.prompt.length > 0 && fu.prompt.length <= 120;
        })
        .slice(0, 2); // Hard cap at 2 follow-ups
    }

    // Convert to required return format with dedupe keys
    const followupsWithKeys = followUpsRaw.map((fu) => {
      const dedupeKey = makeAnswerKey({
        questionId: fu.id,
        answer: fu.prompt,
        isFollowUp: true,
      });

      return {
        id: fu.id,
        text: fu.prompt,
        source: "ai" as const,
        dedupeKey,
        questionId: validated.questionId, // Parent question ID
      };
    });

    // Include acknowledgment in response if provided
    const responseWithAcknowledgment = {
      followups: followupsWithKeys,
      ...(acknowledgment && { acknowledgment }),
    };

    // Cache successful follow-ups for this question
    const cacheKey = `${projectId}:${validated.questionId}`;
    if (followupsWithKeys.length > 0) {
      const cachedFormat = followupsWithKeys.map((fu) => ({
        id: fu.id,
        prompt: fu.text,
      }));
      lastGoodFollowups.set(cacheKey, cachedFormat);
    }

    // Save to ProjectPost.provenance.interview.followUps (persist per question)
    try {
      const post = await prisma.projectPost.findUnique({
        where: { projectId },
      });

      if (post) {
        const provenance = (post.provenance as any) || {};
        const interview = provenance.interview || {};
        const existingFollowUps = interview.followUps || [];
        
        // Update or add follow-ups for this question
        const filtered = existingFollowUps.filter(
          (group: any) => group.questionId !== validated.questionId
        );
        const newGroup = {
          questionId: validated.questionId,
          followUps: followUpsWithKeys.map((fu) => ({
            id: fu.id,
            prompt: fu.text,
          })),
        };
        
        interview.followUps = [...filtered, newGroup];

        await prisma.projectPost.update({
          where: { projectId },
          data: {
            provenance: {
              ...provenance,
              interview,
            },
          },
        });
      }
    } catch (persistError) {
      console.warn("[followups-single] Failed to persist follow-ups (non-blocking):", persistError);
    }

    // Analytics (non-blocking)
    import("@/lib/analytics")
      .then(({ logPassiveEvent }) => {
        return logPassiveEvent({
          type: "save" as any,
          projectId,
          actorId: session.user.id,
          payload: {
            event: "followup_generated",
            questionId: validated.questionId,
            count: followupsWithKeys.length,
          },
        });
      })
      .catch((analyticsError) => {
        console.warn("Analytics logging failed (non-blocking):", analyticsError);
      });

      return NextResponse.json({ ok: true, ...responseWithAcknowledgment, _cid }, { status: 200 });
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
    console.error("[posting/interview/followups/single] Error:", { requestId, error });
    return NextResponse.json(
      { error: "server_error", requestId },
      { status: 500 }
    );
  }
}

