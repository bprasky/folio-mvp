import { legacyInterviewBoundary } from '@/lib/spotlight/legacyBoundary';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import { prisma } from "@/lib/prisma";
import { Prisma } from '@prisma/client';
import { assertProjectWrite } from "@/lib/authz/access";
import { callLLM } from "@/lib/posting/llmClient";
import { ensureUnder, summarizeBudget } from "@/lib/posting/contextBudget";
import { compactImages, compactProducts, softModerate } from "@/lib/posting/promptBuilders";
import { cid } from "@/lib/utils/correlation";
import { formatKnownFacts, type KnownFacts } from "@/lib/interview/distillInterviewFacts";
import { z } from "zod";
import { randomUUID } from "crypto";
import { MODELS } from '@/lib/ai/models';
import { thinkingSettingsFor, thinkingParams, firstTextBlock } from '@/lib/ai/thinking';
import { FOLIO_INTERVIEWER_PERSONA } from "@/lib/interview/prompts/persona";
import { SHARED_RULE_BLOCK, ARRIVALS_CONTRAST_POLICY } from "@/lib/interview/prompts/rules";
import { isArrivalSafe } from "@/lib/interview/prompts/validateQuestion";

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

const BATCH_FOLLOWUP_SYSTEM_PROMPT = `${FOLIO_INTERVIEWER_PERSONA}

${SHARED_RULE_BLOCK}

${ARRIVALS_CONTRAST_POLICY}

Interview the designer about their project for a design magazine feature. Based on the designer's answers to the previous round of questions, generate follow-up questions that dig deeper into the most interesting and story-rich aspects of what they shared.

RULES:
- Reference specific things the designer said. Not generic questions.
- Chase stories: if they mentioned changing their mind, ask what the original choice was. If they mentioned a compromise, ask what the client wanted vs what they wanted.
- Chase details: if they mentioned a specific product, ask why that one and what they considered instead.
- Chase the decision behind the feeling: if they expressed pride in a choice, go there. If they raised a tension or compromise, chase how they resolved it — the arrival, not the grievance.
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
  const spotlightBoundary = await legacyInterviewBoundary(request);
  if (spotlightBoundary) return spotlightBoundary;

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

    // Fetch project context (+ stored fact digest from the About This Project answers)
    const [projectData, projectPost] = await Promise.all([
      prisma.project.findUnique({
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
      }),
      prisma.projectPost.findUnique({
        where: { projectId },
        select: { provenance: true },
      }),
    ]);

    if ((projectPost?.provenance as any)?.interview?.guided) {
      return NextResponse.json({ error: 'GUIDED_INTERVIEW_ACTIVE', message: 'Continue the saved guided interview.' }, { status: 409 });
    }

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

    const isProjectPhase = validated.roomName === 'About This Project' || validated.roomId === 'project';
    prompt += `\n${isProjectPhase ? 'Phase: About This Project (project-level overview)' : `Room: ${validated.roomName}`}`;
    prompt += `\nRound: ${validated.round} (${validated.round === 1 ? 'first follow-up round' : 'deep follow-up round'})`;

    if (isProjectPhase) {
      prompt += `\n\nIMPORTANT: These are PROJECT-LEVEL follow-ups. Stay at 30,000 feet.

PROJECT-LEVEL FOLLOW-UP GOAL:
Your job is to fill in the WHO, WHAT, WHERE, WHEN, WHY of this project. Check which of those are still unanswered or thin after the designer's answers, and follow up on the GAPS.

SCOPE RULES:
- DO NOT chase room-specific details. If the designer says "the kitchen island was a whole saga and we rethought the bar halfway through":
  - GOOD: "Was that kind of evolution typical for this project, or were those isolated surprises?"
  - GOOD: "How did the clients handle those changes — were they flexible or did it create tension?"
  - BAD: "Tell me about that moment at the slab yard when you found the bookmatched piece"
  - BAD: "What specifically changed about the bar concept?"
  The slab yard story and the bar rethink belong in ROOM-LEVEL interviews where we have photos to reference.
- If the designer's answer covers one category well but leaves another untouched, PIVOT to the uncovered category rather than drilling deeper into the one they already addressed.
- Push for SPECIFICITY and STORIES within the project-level frame:
  - If they say "the client wanted modern," follow up: "Modern can mean a lot of things — what did it mean for them specifically?"
  - If they mention a decision, follow up: "How did that come about? Was that in the original plan or did it evolve?"
  - If they mention a person or relationship, follow up with the human story.
- The goal is solid coverage of ALL FIVE categories: who the client is, what the scope was, what the design direction was, what makes this designer's work recognizable, and what surprised them. That's the complete narrative frame.
- These answers become the pull quote material for the editorial. Go deep, but stay wide.\n`;
    } else {
      prompt += `\n\nROOM-LEVEL FOLLOW-UP GOAL:
Your job is to draw out the STORY behind specific decisions visible in the photos and referenced in the designer's base answers.

Push for:
- "What did you try first?" — the rejected option reveals the thinking
- "How did the client react to that choice?" — the human moment
- "Tell me about working with the vendor/fabricator on that" — the process story
- "What would someone miss if they just glanced at this room?" — the hidden detail

These follow-ups produce the richest editorial material: anecdotes, turning points, behind-the-scenes texture. This is where "we went to the slab yard three times" and "the fabricator was nervous about the waterfall edge" come from.

Room follow-ups should reference BOTH the photos AND what the designer said in their base answer. If the designer mentioned a specific product, ask why that one and what they considered instead. If they described a material or finish, ask about the tactile or experiential quality. If they mentioned a vendor relationship, push on that story.

Stay focused on THIS room: ${validated.roomName}. Do not drift to project-level narrative or other rooms unless the designer explicitly connected them.\n`;

      // Established project facts (distilled from the About This Project answers).
      // Wording aid only — stops room follow-ups re-asking settled ground.
      const knownFacts = ((projectPost?.provenance as any)?.interview?.knownFacts ?? null) as KnownFacts | null;
      const knownFactsLines = formatKnownFacts(knownFacts);
      if (knownFactsLines) {
        prompt += `\nESTABLISHED PROJECT FACTS (from the designer's earlier project-level answers):
${knownFactsLines}

Do NOT re-ask any of this — it is settled ground. Use it only to sharpen wording. It must not pull your follow-ups toward project-level topics: this room's answers and photos decide what you chase.\n`;
      }
    }

    // Designer's answers from the previous round
    prompt += `\n\nDesigner's answers${isProjectPhase ? '' : ' from this room'}:\n`;
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
          system: BATCH_FOLLOWUP_SYSTEM_PROMPT,
          messages: [{ role: "user", content: prompt }],
          max_tokens: 500 * thinkingSettings.maxTokensMultiplier,
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
    const rawText = firstTextBlock(llmResult.data) || '{}';
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

    // Arrivals/contrast gate (docs/17 §3): drop grievance/regret follow-ups.
    const followUpsGated = followUpsRaw.filter((fu) => isArrivalSafe(fu.question));
    if (followUpsGated.length < followUpsRaw.length) {
      console.info(`[followups-batch] arrivals gate dropped ${followUpsRaw.length - followUpsGated.length} follow-up(s)`, { _cid });
    }

    const followUps = followUpsGated.slice(0, validated.maxFollowUps).map((fu) => ({
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

    // Recheck guided ownership after the model call, then CAS the fresh snapshot.
    try {
      const freshPost = await prisma.projectPost.findUnique({
        where: { projectId },
        select: { provenance: true, updatedAt: true },
      });

      if (freshPost) {
        const freshProvenance = (freshPost.provenance as any) || {};
        const freshInterview = { ...(freshProvenance.interview || {}) };
        if (freshInterview.guided) {
          return NextResponse.json({ error: 'GUIDED_INTERVIEW_ACTIVE', message: 'Continue the saved guided interview.' }, { status: 409 });
        }
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
