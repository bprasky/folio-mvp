export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import { prisma } from "@/lib/prisma";
import { assertProjectWrite } from "@/lib/authz/access";
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
const ANTHROPIC_ENABLED =
  !!process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_ENABLED !== "false";
const SYSTEM_PROMPT = `You are an editorial interviewer for a design magazine. Based on the designer's initial answers about their project, generate follow-up questions that dig deeper into the most interesting aspects of their work.

Focus on:
- Specific design decisions that reveal creative process (not just product selection)
- Material relationships that tell a story (why these things work together)
- Moments of surprise, change, or evolution during the project
- Vendor/product choices that have genuine reasoning behind them
- Spatial experiences: how does moving through the space feel? What reveals itself?

Rules:
- Ask about ARRIVALS, not departures. "What clicked about this choice?" not "Why did you reject the alternatives?"
- Frame questions to elicit quotable, publishable answers
- Be specific — reference actual products, rooms, or details from their answers
- Avoid generic questions like "What inspired you?" — dig into specifics
- Keep each question under 180 characters
- Generate 1-2 follow-ups per answer, only where something interesting can be drawn out
- Skip answers that are already rich and complete

Examples of good follow-up questions:
- "The sofa went through a few rounds before you landed on the RH Cloud. What clicked about this one?"
- "Waterworks appears throughout the bathrooms. What keeps you coming back to them?"
- "You mentioned the island needed to feel like furniture. How did you get there — was that always the plan or did it evolve?"
- "The copper pendant is the only warm metal in the space. Was that a deliberate anchor point, or did it emerge?"

Return a JSON object with a "followUps" array where each item has:
- questionId: the original question ID
- followUps: array of { id: string, prompt: string }

Only include items where you have meaningful follow-ups.

Example format:
{
  "followUps": [
    {
      "questionId": "why-2",
      "followUps": [
        { "id": "fu-why-2-1", "prompt": "You mentioned the marble was a late decision. What changed your mind — was there a moment it clicked?" }
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

    // Check project write access (owner, designer, org member, or admin)
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
    if (!ANTHROPIC_ENABLED) {
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

    // Call Anthropic with LLM client wrapper
    const modelName = 'claude-sonnet-4-20250514';

    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const anthropic = new Anthropic();

    const llmResult = await callLLM(
      async () => {
        return await anthropic.messages.create({
          model: modelName,
          system: SYSTEM_PROMPT,
          messages: [
            { role: "user", content: prompt },
          ],
          temperature: 0.7,
          max_tokens: 800,
        });
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

    const rawText = llmResult.data.content[0]?.type === 'text' ? llmResult.data.content[0].text : '{}';
    const raw = rawText.replace(/```json\n?|\n?```/g, '').trim();
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
                return fu.prompt.length > 0 && fu.prompt.length <= 180;
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
      // IMPORTANT: Read-then-write must be atomic to avoid overwriting concurrent answer saves.
      // We re-read provenance immediately before writing to minimize the race window.
      try {
        const freshPost = await prisma.projectPost.findUnique({
          where: { projectId },
          select: { provenance: true },
        });

        if (freshPost) {
          // Store in the format expected by client (grouped by questionId)
          const groupedFollowUps = followUpsRaw.map((group) => ({
            questionId: group.questionId,
            followUps: group.followUps.map((fu) => ({
              id: fu.id,
              prompt: fu.prompt,
            })),
          }));

          // Re-read provenance fresh to avoid overwriting concurrent writes (e.g., answer saves)
          const freshProvenance = (freshPost.provenance as any) || {};
          const freshInterview = { ...(freshProvenance.interview || {}) };
          freshInterview.followUps = groupedFollowUps;

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

