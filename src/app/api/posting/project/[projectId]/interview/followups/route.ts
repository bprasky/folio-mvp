export const dynamic = 'force-dynamic';

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
import { compactImages, compactProducts, frameFollowupsPrompt, softModerate } from "@/lib/posting/promptBuilders";
import { cid } from "@/lib/utils/correlation";
import { z } from "zod";
import { randomUUID } from "crypto";

// Cache last good follow-ups in-memory (dev/runtime only)
const lastGoodFollowups = new Map<string, Array<{ id: string; prompt: string }>>();

const FollowUpsRequestSchema = z.object({
  answers: z.array(
    z.object({
      questionId: z.string(),
      answer: z.string(),
    })
  ),
  mode: z.enum(["generate", "regenerate"]).optional(),
});

const POSTING_V1_ENABLED =
  (process.env.POSTING_V1 ?? "").toLowerCase() === "true" ||
  (process.env.NEXT_PUBLIC_POSTING_V1 ?? "").toLowerCase() === "true" ||
  process.env.NODE_ENV !== "production";
const OPENAI_ENABLED =
  !!process.env.OPENAI_API_KEY && process.env.OPENAI_ENABLED !== "false";
const SYSTEM_PROMPT = `You are an editorial interviewer for Folio. For each designer answer below, suggest up to two open-ended follow-up questions that could draw out a richer narrative. Only ask when something is interesting or vague. Keep each under 120 characters. Do not repeat or rephrase the original question.

Return a JSON object with a "followUps" array where each item has:
- questionId: the original question ID
- followUps: array of { id: string, prompt: string }

Only include items where you have meaningful follow-ups. Skip answers that are already rich and complete.

Example format:
{
  "followUps": [
    {
      "questionId": "why-2",
      "followUps": [
        { "id": "fu-why-2-1", "prompt": "What made that direction feel right emotionally?" }
      ]
    }
  ]
}`;

export async function POST(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  const _cid = cid('followups');
  try {
    if (!POSTING_V1_ENABLED) {
      return NextResponse.json(
        { error: "posting_disabled" },
        { status: 404 }
      );
    }

    console.info('[followups] start', { _cid, projectId: params.projectId });
    const requestId = randomUUID();
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
      validated = FollowUpsRequestSchema.parse(body);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return NextResponse.json(
          { error: "validation_failed", issues: err.issues },
          { status: 422 }
        );
      }
      throw err;
    }

    if (!Array.isArray(validated.answers) || validated.answers.length === 0) {
      return NextResponse.json(
        { ok: false, error: "invalid_body", message: "answers array is required and must not be empty" },
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

    // Normalize and dedupe answers using shared utility
    const normalizedAnswers = normalizeAnswers(
      validated.answers.map((a) => ({
        questionId: a.questionId,
        answer: a.answer,
        role: "DESIGNER" as const,
      }))
    );

    // Soft moderation (non-blocking)
    try {
      const mod = await moderateAnswers(
        normalizedAnswers.map((a) => ({
          questionId: a.questionId,
          answer: a.answer,
        }))
      );
      // Log if flagged but continue (soft moderation)
      if (mod.flagged) {
        console.warn("[followups] Moderation flagged answers:", mod.fields);
      }
    } catch (modError) {
      console.warn("[followups] Moderation failed (non-blocking):", modError);
    }

    // If OpenAI not available, return explicit error (not ok:true)
    if (!OPENAI_ENABLED) {
      console.warn('[followups] LLM disabled/unavailable');
      // Check cache before returning error
      const cached = lastGoodFollowups.get(projectId);
      if (cached?.length) {
        console.warn('[followups] LLM unavailable; serving cached followups');
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

    // Build base answers text with soft moderation
    const baseAnswersRaw = normalizedAnswers
      .map((a) => `[${a.questionId}]: ${a.answer}`)
      .join("\n\n");
    const baseModerated = softModerate(baseAnswersRaw);
    if (baseModerated.changed) {
      console.info('[followups] softModerated base answers', { _cid });
    }

    // Build prompt using frameFollowupsPrompt
    let prompt = frameFollowupsPrompt({
      projectTitle: projectData?.title || "Untitled",
      city: projectData?.city || projectData?.regionState || undefined,
      clientType: projectData?.projectType || undefined,
      baseAnswers: baseModerated.text,
      imagesCompact,
      productsCompact,
    });

    // Enforce budget now
    const MAX_TOKENS = 7000;
    prompt = ensureUnder(prompt, MAX_TOKENS);

    // Check prompt budget and log
    const budget = summarizeBudget({ system: SYSTEM_PROMPT, user: prompt, full: `${SYSTEM_PROMPT}\n\n${prompt}` });
    console.info('[followups] budget(tokens)', { _cid, budget });

    // Call OpenAI with LLM client wrapper
    const modelName = process.env.OPENAI_MODEL || 'gpt-4o-mini';
    
    // Model sanity check
    if (!/gpt|o\d|4|mini|omni/i.test(modelName)) {
      console.warn('[posting] suspicious model name', { modelName, _cid });
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
            max_tokens: 500,
            response_format: { type: "json_object" },
          }
        );
      },
      { modelName, contextHint: `followups:${projectId}` }
    );

    if (!llmResult.ok) {
      console.error('[followups] llm_fail', {
        _cid,
        code: llmResult.code,
        status: llmResult.status,
        msg: llmResult.message,
      });
      
      // Check cache before returning error
      const cached = lastGoodFollowups.get(projectId);
      if (cached?.length) {
        console.warn('[followups] llm_fail; serving cached followups', { _cid });
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

    console.info('[followups] llm_ok', { _cid, model: llmResult.usedModel });

    const raw = llmResult.data.choices?.[0]?.message?.content || "{}";
    const json = JSON.parse(raw);

      // Validate response structure and convert to required format
      // Expected: { followUps: [{ questionId: string, followUps: [{ id: string, prompt: string }] }] }
      let followUpsRaw: Array<{
        questionId: string;
        followUps: Array<{ id: string; prompt: string }>;
      }> = [];

      let followUpsArray = json.followUps;
      if (!Array.isArray(followUpsArray)) {
        followUpsArray = [];
      }

      if (Array.isArray(followUpsArray)) {
        followUpsRaw = followUpsArray
          .map((item: any) => ({
            questionId: item?.questionId,
            followUps: Array.isArray(item?.followUps) ? item.followUps : [],
          }))
          .filter((item: any) => !!item.questionId)
          .map((item: any) => {
            const sanitized = item.followUps
              .map((fu: any) => ({
                id:
                  fu?.id ||
                  `fu-${item.questionId}-${Math.random()
                    .toString(36)
                    .slice(2, 11)}`,
                prompt: typeof fu?.prompt === "string" ? fu.prompt.trim() : "",
              }))
              .filter((fu: any) => {
                return fu.prompt.length > 0 && fu.prompt.length <= 120;
              });
            return {
              questionId: item.questionId,
              followUps: sanitized,
            };
          })
          .filter((item) => item.followUps.length);
      }

      // Convert to required return format with dedupe keys
      const followupsWithKeys = followUpsRaw.flatMap((group) =>
        group.followUps.map((fu) => {
          // Create a dedupe key using the shared makeAnswerKey utility
          // For follow-ups, we use a placeholder answer to generate the key
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
            questionId: group.questionId, // Keep for grouping on client
          };
        })
      );

      // Dedupe by dedupeKey to avoid repeats
      const seenKeys = new Set<string>();
      const dedupedFollowups = followupsWithKeys.filter((fu) => {
        if (seenKeys.has(fu.dedupeKey)) {
          return false;
        }
        seenKeys.add(fu.dedupeKey);
        return true;
      });

      // Cache successful follow-ups for this project
      if (dedupedFollowups.length > 0) {
        const cachedFormat = dedupedFollowups.map((fu) => ({
          id: fu.id,
          prompt: fu.text,
        }));
        lastGoodFollowups.set(projectId, cachedFormat);
      }

      // Save to ProjectPost.provenance.interview.followUps (optional persistence)
      try {
        const post = await prisma.projectPost.findUnique({
          where: { projectId },
        });

        if (post) {
          const provenance = (post.provenance as any) || {};
          const interview = provenance.interview || {};
          
          // Store in the format expected by client (grouped by questionId)
          const groupedFollowUps = followUpsRaw.map((group) => ({
            questionId: group.questionId,
            followUps: group.followUps.map((fu) => ({
              id: fu.id,
              prompt: fu.prompt,
            })),
          }));

          interview.followUps = groupedFollowUps;

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
        console.warn("[followups] Failed to persist follow-ups (non-blocking):", persistError);
        // Continue even if persistence fails
      }

      // Analytics (non-blocking)
      import("@/lib/analytics")
        .then(({ logPassiveEvent }) => {
          return logPassiveEvent({
            type: "save" as any,
            projectId,
            actorId: session.user.id,
            payload: {
              event: "followups_generated",
              count: dedupedFollowups.length,
              mode: validated.mode || "generate",
            },
          });
        })
        .catch((analyticsError) => {
          console.warn("Analytics logging failed (non-blocking):", analyticsError);
        });

      return NextResponse.json({ ok: true, followups: dedupedFollowups, _cid }, { status: 200 });
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
    console.error("[posting/interview/followups] Error:", { requestId, error });
    return NextResponse.json(
      { error: "server_error", requestId },
      { status: 500 }
    );
  }
}

