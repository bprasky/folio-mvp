import { legacyInterviewBoundary } from '@/lib/spotlight/legacyBoundary';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import { prisma } from "@/lib/prisma";
import { Prisma } from '@prisma/client';
import { assertProjectWrite } from "@/lib/authz/access";
import { normalizeAnswers, makeAnswerKey } from "@/lib/posting/interviewSchemas";
import { moderateAnswers } from "@/lib/posting/moderation";
import { callLLM } from "@/lib/posting/llmClient";
import { approxTokens, summarizeBudget, ensureUnder } from "@/lib/posting/contextBudget";
import { compactImages, compactProducts, softModerate } from "@/lib/posting/promptBuilders";
import { cid } from "@/lib/utils/correlation";
import { z } from "zod";
import { randomUUID } from "crypto";
import { digestInterviewAnswer } from "@/lib/interview/digestInterviewAnswer";
import { MODELS } from '@/lib/ai/models';
import { thinkingSettingsFor, thinkingParams, firstTextBlock } from '@/lib/ai/thinking';
import { FOLIO_INTERVIEWER_PERSONA } from "@/lib/interview/prompts/persona";
import { SHARED_RULE_BLOCK, ARRIVALS_CONTRAST_POLICY } from "@/lib/interview/prompts/rules";
import { isArrivalSafe } from "@/lib/interview/prompts/validateQuestion";

// Cache last good follow-ups per question (dev/runtime only)
const lastGoodFollowups = new Map<string, Array<{ id: string; prompt: string }>>();

const SingleFollowUpRequestSchema = z.object({
  questionId: z.string(),
  answer: z.string(),
  previousAnswers: z.array(z.object({
    question: z.string(),
    answer: z.string(),
  })).optional(),
  remainingQuestions: z.array(z.object({
    id: z.string(),
    question: z.string(),
  })).optional(),
  // Room pacing fields (Phase B)
  roomId: z.string().optional(),
  roomName: z.string().optional(),
  roomAnswers: z.array(z.object({
    question: z.string(),
    answer: z.string(),
  })).optional(),
  crossRoom: z.boolean().optional(),
  completedRooms: z.array(z.object({
    roomName: z.string(),
    keyThemes: z.array(z.string()),
  })).optional(),
});

const POSTING_V1_ENABLED =
  (process.env.POSTING_V1 ?? "").toLowerCase() === "true" ||
  (process.env.NEXT_PUBLIC_POSTING_V1 ?? "").toLowerCase() === "true" ||
  process.env.NODE_ENV !== "production";
const ANTHROPIC_ENABLED =
  !!process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_ENABLED !== "false";

const SYSTEM_PROMPT = `${FOLIO_INTERVIEWER_PERSONA}

${SHARED_RULE_BLOCK}

${ARRIVALS_CONTRAST_POLICY}

Based on the designer's answer below, generate follow-up questions that dig deeper into the most interesting aspects of their work.

Focus on: specific design decisions that reveal process, material relationships that tell a story, moments of evolution during the project, and spatial experiences. Frame questions to elicit quotable, publishable answers. Be specific — reference actual products, rooms, or details. Keep each under 180 characters. Do not repeat or rephrase the original question. Do NOT ask about topics the designer has already covered in previous answers.

Optionally, provide a brief acknowledgment sentence (1-2 sentences, under 150 characters) that naturally transitions to the follow-up questions. This should feel conversational and acknowledge what the designer shared.

If a list of remaining questions is provided, evaluate whether the designer's answers so far already cover any of them. For each affected question:
- If FULLY covered (nothing meaningful left to ask): mark as "covered"
- If PARTIALLY covered (designer touched on the topic but from a different room or angle): return a "morphed" version that references what they already said and asks about the new angle

Morphed questions should:
- Be under 200 characters
- Reference what the designer said ("You mentioned X...")
- Bridge to the new context ("...how does that carry into the living room?")
- Feel natural and insightful, not mechanical

Return a JSON object with:
- acknowledgment: string (optional, 1-2 sentences transitioning to follow-ups)
- followUps: array of { id: string, prompt: string }
- questionUpdates: array of { id: string, status: "covered" | "morphed", morphedText?: string }

Only include follow-ups if the answer would benefit from deeper exploration. Skip if the answer is already rich and complete. Most remaining questions will NOT be affected — only include ones where answers clearly overlap.

Example:
{
  "acknowledgment": "That's a beautiful detail about the marble selection.",
  "followUps": [
    { "id": "fu-1", "prompt": "What made that direction feel right emotionally?" }
  ],
  "questionUpdates": [
    { "id": "q_materials_3", "status": "covered" },
    { "id": "q_living_1", "status": "morphed", "morphedText": "You mentioned the warm wood tones in the kitchen — how did you carry that warmth into the living room?" }
  ]
}`;

export async function POST(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  const spotlightBoundary = await legacyInterviewBoundary(request);
  if (spotlightBoundary) return spotlightBoundary;

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

    // Check project write access (owner, designer, org member, or admin)
    try {
      await assertProjectWrite(session.user.id, projectId);
    } catch (e: any) {
      if (e.message === "NotFound") {
        return NextResponse.json({ error: "Project not found" }, { status: 404 });
      }
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const savedPost = await prisma.projectPost.findUnique({ where: { projectId }, select: { provenance: true } });
    const sourceResetId = (savedPost?.provenance as any)?.interview?.resetId ?? null;
    if ((savedPost?.provenance as any)?.interview?.guided) {
      return NextResponse.json({ error: 'GUIDED_INTERVIEW_ACTIVE', message: 'Continue the saved guided interview.' }, { status: 409 });
    }

    // Validate input
    const body = await request.json();
    if ((body?.resetId ?? null) !== sourceResetId)
      return NextResponse.json({ error: 'INTERVIEW_RESET', message: 'This interview was started over. Reload before continuing.' }, { status: 409 });
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

    // If Anthropic not available, return explicit error
    if (!ANTHROPIC_ENABLED) {
      console.warn('[followups-single] LLM disabled/unavailable');
      // Check cache before returning error
      const cacheKey = `${projectId}:${sourceResetId ?? 'initial'}:${validated.questionId}`;
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

    // Room pacing context (Phase B)
    if (validated.roomName) {
      prompt += `\nCurrent room: ${validated.roomName}`;
    }
    if (validated.crossRoom && validated.completedRooms?.length) {
      prompt += `\n\nCross-room synthesis: Generate a follow-up connecting themes across these rooms:`;
      for (const room of validated.completedRooms) {
        prompt += `\n- ${room.roomName}: ${room.keyThemes.join(', ')}`;
      }
    }

    prompt += `\n\nDesigner's answer:\n${moderated.text}`;

    if (imagesCompact.trim()) {
      prompt += `\n\nContext:\n${imagesCompact}`;
    }
    if (productsCompact.trim()) {
      prompt += `\n${productsCompact}`;
    }

    // Include previous answers — use room-scoped answers if available, otherwise all
    const previousAnswersToUse = validated.roomAnswers?.length
      ? validated.roomAnswers
      : validated.previousAnswers;
    if (previousAnswersToUse?.length) {
      prompt += `\n\nTopics already discussed (do NOT repeat these):\n`;
      for (const prev of previousAnswersToUse.slice(-5)) {
        prompt += `- "${prev.question}": ${prev.answer.slice(0, 150)}\n`;
      }
    }

    // Include remaining questions for coverage evaluation + morphing
    if (validated.remainingQuestions?.length) {
      prompt += `\n\nRemaining questions not yet asked:\n`;
      for (const rq of validated.remainingQuestions) {
        prompt += `- [${rq.id}]: "${rq.question}"\n`;
      }
      prompt += `\nFor each remaining question affected by prior answers, add to "questionUpdates": { id, status: "covered"|"morphed", morphedText? }. Morph (don't skip) questions the designer partially addressed — reference what they said and ask about the new angle.`;
    }

    prompt += `\n\nGenerate 0-2 follow-up questions that dig deeper into the most interesting aspects of this answer. Reference specific products, rooms, or details from what the designer said. Frame questions to elicit quotable, publishable answers. Keep each under 180 characters.`;

    // Run answer digestion for adaptive follow-up context
    const vendorNames = taggedProducts
      .map((p: any) => p.vendor)
      .filter((v: string | null): v is string => !!v);
    const productNamesList = taggedProducts
      .map((p: any) => p.name)
      .filter((n: string | null): n is string => !!n);

    const digest = digestInterviewAnswer(validated.answer, {
      vendorNames,
      productNames: productNamesList,
    });

    // Inject digest context into prompt
    if (digest.isThin) {
      prompt += `\n\nNOTE: The designer's answer was brief (${digest.thinReason}). Generate a warm follow-up that invites them to elaborate with a specific detail. Frame it as "Walk us through..." or "Tell us about the moment when..." rather than repeating the question.`;
    }

    if (digest.hasUnpulledThread && digest.threadHint) {
      prompt += `\n\nNOTE: The designer hinted at a story ("${digest.threadHint.slice(0, 100)}"). Follow up on this specific thread — they started something interesting.`;
    }

    if (digest.vendorSentiments.some((v) => v.sentiment === 'positive')) {
      const posVendor = digest.vendorSentiments.find((v) => v.sentiment === 'positive');
      if (posVendor) {
        prompt += `\n\nNOTE: The designer spoke positively about ${posVendor.vendorName}. A deeper quote about this relationship has editorial boost potential. Lean in gently.`;
      }
    }

    if (digest.philosophySignals.length > 0) {
      prompt += `\n\nNOTE: The designer expressed a design belief: "${digest.philosophySignals[0].slice(0, 120)}". This is valuable fingerprint data. If natural, invite them to expand on how this philosophy shaped specific decisions in this project.`;
    }

    if (digest.richnessScore > 0.7 && !digest.hasUnpulledThread) {
      prompt += `\n\nNOTE: This answer is already rich and complete. Only generate a follow-up if there's a clear new thread worth pulling. It's fine to return no follow-up.`;
    }

    // Enforce budget
    const MAX_TOKENS = 4000;
    prompt = ensureUnder(prompt, MAX_TOKENS);

    // Check prompt budget and log
    const budget = summarizeBudget({ system: SYSTEM_PROMPT, user: prompt, full: `${SYSTEM_PROMPT}\n\n${prompt}` });
    console.info('[followups-single] budget(tokens)', { _cid, budget });

    // Call Anthropic with LLM client wrapper
    const modelName = MODELS.sonnet;
    // Follow-ups are generated while the designer waits, so adaptive thinking
    // is a latency tradeoff here in a way it is not for the async article.
    // Off unless ADAPTIVE_THINKING_SURFACES includes `followups`.
    const thinkingSettings = thinkingSettingsFor('followups');

    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const anthropic = new Anthropic();

    const llmResult = await callLLM(
      async () => {
        return await anthropic.messages.create({
          model: modelName,
          ...thinkingParams(thinkingSettings),
          system: SYSTEM_PROMPT,
          messages: [
            { role: "user", content: prompt },
          ],
          max_tokens: 300 * thinkingSettings.maxTokensMultiplier,
        });
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
      const cacheKey = `${projectId}:${sourceResetId ?? 'initial'}:${validated.questionId}`;
      const cached = lastGoodFollowups.get(cacheKey);
      if (cached?.length) {
        console.warn('[followups-single] llm_fail; serving cached followups', { _cid });
        return NextResponse.json({ ok: true, followups: cached, _cid }, { status: 200 });
      }
      
      // Follow-ups are an enhancement, not a gate — degrade gracefully
      return NextResponse.json(
        { ok: true, followups: [], questionUpdates: [], _cid },
        { status: 200 }
      );
    }

    console.info('[followups-single] llm_ok', { _cid, model: llmResult.usedModel });

    const rawText = firstTextBlock(llmResult.data) || '{}';
    const raw = rawText.replace(/```json\n?|\n?```/g, '').trim();
    let json: any;
    try {
      json = JSON.parse(raw);
    } catch (parseErr) {
      console.error('[FOLLOWUP_ERROR] json_parse_failed', { _cid, raw: raw.slice(0, 200), parseErr });
      return NextResponse.json(
        { ok: true, followups: [], questionUpdates: [], _cid },
        { status: 200 }
      );
    }

    // Extract acknowledgment (optional)
    const acknowledgment = typeof json.acknowledgment === "string"
      ? json.acknowledgment.trim().slice(0, 150)
      : undefined;

    // Extract question updates (morphed or covered)
    interface QuestionUpdate {
      id: string;
      status: 'covered' | 'morphed';
      morphedText?: string;
    }
    const questionUpdates: QuestionUpdate[] = Array.isArray(json.questionUpdates)
      ? json.questionUpdates
          .filter((u: any) => u?.id && (u.status === 'covered' || u.status === 'morphed'))
          .map((u: any) => ({
            id: String(u.id),
            status: u.status as 'covered' | 'morphed',
            morphedText: u.status === 'morphed' && typeof u.morphedText === 'string'
              ? u.morphedText.trim().slice(0, 200)
              : undefined,
          }))
      : [];

    // Backward compat: derive coveredQuestionIds from questionUpdates
    const coveredQuestionIds: string[] = questionUpdates
      .filter(u => u.status === 'covered')
      .map(u => u.id);

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
          return fu.prompt.length > 0 && fu.prompt.length <= 180;
        })
        .slice(0, 2); // Hard cap at 2 follow-ups
    }

    // Arrivals/contrast gate (docs/17 §3): drop grievance/regret follow-ups.
    {
      const before = followUpsRaw.length;
      followUpsRaw = followUpsRaw.filter((fu) => isArrivalSafe(fu.prompt));
      if (followUpsRaw.length < before) {
        console.info(`[followups-single] arrivals gate dropped ${before - followUpsRaw.length} follow-up(s)`, { _cid });
      }
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

    // Build response with optional fields
    const responsePayload = {
      followups: followupsWithKeys,
      ...(acknowledgment && { acknowledgment }),
      ...(coveredQuestionIds.length > 0 && { coveredQuestionIds }),
      ...(questionUpdates.length > 0 && { questionUpdates }),
    };

    // Cache successful follow-ups for this question
    const cacheKey = `${projectId}:${sourceResetId ?? 'initial'}:${validated.questionId}`;
    if (followupsWithKeys.length > 0) {
      const cachedFormat = followupsWithKeys.map((fu) => ({
        id: fu.id,
        prompt: fu.text,
      }));
      lastGoodFollowups.set(cacheKey, cachedFormat);
    }

    // Save to ProjectPost.provenance.interview.followUps (persist per question)
    // Recheck after the model call and CAS the same snapshot: an older tab must
    // never replace a guided session or a newer answer save.
    try {
      const freshPost = await prisma.projectPost.findUnique({
        where: { projectId },
        select: { provenance: true, updatedAt: true },
      });

      if (freshPost) {
        const freshProvenance = (freshPost.provenance as any) || {};
        const freshInterview = { ...(freshProvenance.interview || {}) };
        if ((freshInterview.resetId ?? null) !== sourceResetId) {
          return NextResponse.json({ error: 'INTERVIEW_CHANGED', message: 'The interview was restarted. Continue from the beginning.' }, { status: 409 });
        }
        if (freshInterview.guided) {
          return NextResponse.json({ error: 'GUIDED_INTERVIEW_ACTIVE', message: 'Continue the saved guided interview.' }, { status: 409 });
        }
        const existingFollowUps = freshInterview.followUps || [];

        // Update or add follow-ups for this question
        const filtered = existingFollowUps.filter(
          (group: any) => group.questionId !== validated.questionId
        );
        const newGroup = {
          questionId: validated.questionId,
          followUps: followupsWithKeys.map((fu) => ({
            id: fu.id,
            prompt: fu.text,
          })),
        };

        freshInterview.followUps = [...filtered, newGroup];

        const saved = await prisma.projectPost.updateMany({
          where: { projectId, updatedAt: freshPost.updatedAt, provenance: { equals: freshPost.provenance === null ? Prisma.DbNull : freshPost.provenance } },
          data: {
            provenance: {
              ...freshProvenance,
              interview: freshInterview,
            },
          },
        });
        if (saved.count !== 1) {
          return NextResponse.json({ error: 'INTERVIEW_CHANGED', message: 'The interview changed. Reload before continuing.' }, { status: 409 });
        }
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

      return NextResponse.json({ ok: true, ...responsePayload, _cid }, { status: 200 });
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
    console.error("[FOLLOWUP_ERROR] unhandled", { requestId, error: error?.message || error });
    // Follow-ups are an enhancement, not a gate — degrade gracefully
    return NextResponse.json(
      { ok: true, followups: [], questionUpdates: [], requestId },
      { status: 200 }
    );
  }
}

