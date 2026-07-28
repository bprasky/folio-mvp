export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { randomUUID } from "crypto";
import Anthropic from "@anthropic-ai/sdk";
import { HOOK_OPENER_ID_PREFIX, HOOK_FOLLOWUP_ID_PREFIX } from "@/lib/interview/generateQuestions";
import { scorePullQuote } from "@/lib/posting/generateEditorialDraft";
import { MODELS } from '@/lib/ai/models';
import { FOLIO_INTERVIEWER_PERSONA } from "@/lib/interview/prompts/persona";
import { SHARED_RULE_BLOCK, ARRIVALS_CONTRAST_POLICY } from "@/lib/interview/prompts/rules";
import { isArrivalSafe } from "@/lib/interview/prompts/validateQuestion";
import { FOLIO_TONE } from "@/lib/interview/prompts/editorialTone";

// Answers scoring at or above this already carry a hook-quality signal
// (first-person voice + length, or first-person + metaphor). Above the bar,
// skip the deepening follow-up so we don't fish when the designer already
// said something publication-ready.
const HOOK_ANSWER_SUFFICIENT_SCORE = 5;

/**
 * POST /api/interview/respond
 *
 * Submit an answer and get follow-up question.
 * Also returns preview draft after 3-4 responses.
 *
 * Answers are persisted to EditorialInterviewAnswer for durability.
 */

const RequestSchema = z.object({
  sessionId: z.string().min(1),
  projectId: z.string().min(1),
  questionId: z.string().min(1),
  questionText: z.string().optional(),
  answer: z.string().min(1),
  inputMode: z.enum(["voice", "text"]),
});

// Anthropic client - only instantiate if API key is available
let anthropic: Anthropic | null = null;
if (process.env.ANTHROPIC_API_KEY) {
  anthropic = new Anthropic();
}

const GENERIC_FOLLOWUP_SYSTEM = `${FOLIO_INTERVIEWER_PERSONA}

${SHARED_RULE_BLOCK}

${ARRIVALS_CONTRAST_POLICY}

Based on a designer's answer, generate one thoughtful follow-up question that will elicit a more detailed, quotable response.

Guidelines:
- Ask about the "why" behind their decisions
- Focus on intention and process
- Avoid yes/no questions
- Keep questions concise (under 20 words)
- Questions should lead to answers a designer would be proud to publish

Return JSON: { "question": "...", "context": "..." }
The context is a brief lead-in phrase like "You mentioned the light." (optional, can be empty string)`;

const HOOK_FOLLOWUP_SYSTEM = `${FOLIO_INTERVIEWER_PERSONA}

${SHARED_RULE_BLOCK}

${ARRIVALS_CONTRAST_POLICY}

The designer just answered the opening "what were you chasing with this project" question. Your job is to generate ONE deepening follow-up whose answer, spliced with the first answer, will become the article's opening pull quote.

Rules (strict — every word counts):
- Echo the designer's own theme back to them in their words before asking.
- Invite the emotional stakes of the win: what they hoped someone would feel walking in, what made it personal, the moment they knew they'd gotten it right. Reach for the arrival, not what was at risk.
- Do NOT ask about any specific room, product, brand, vendor, material, color, or process step. The opening quote is about the idea and the feeling, not the details.
- Do NOT ask "can you tell me more about" or any therapist-style meta question. Sound like a colleague who was in the room.
- Under 25 words.

Return JSON: { "question": "...", "context": "..." }
The context is a brief lead-in phrase that echoes their theme (e.g. "Staying true while refreshing —"). Keep it under 10 words.`;

/**
 * Generate a follow-up question based on the user's answer.
 *
 * When the parent question is the hook opener we (a) use a specialized
 * system prompt that targets the emotional deepening needed for a spliceable
 * pull quote, and (b) skip the call entirely if the hook answer already
 * scores high enough that pushing further would feel like fishing.
 */
async function generateFollowUp(
  questionText: string,
  answer: string,
  parentQuestionId: string
): Promise<{ text: string; context: string; isHookFollowUp: boolean } | null> {
  if (!anthropic) {
    return null;
  }

  const isHookParent = parentQuestionId.startsWith(HOOK_OPENER_ID_PREFIX);

  // If the hook-opener answer already reads like a publication quote, don't
  // push a deepening follow-up — it'd feel like we're unhappy with what
  // they said.
  if (isHookParent && scorePullQuote(answer) >= HOOK_ANSWER_SUFFICIENT_SCORE) {
    return null;
  }

  try {
    const message = await anthropic.messages.create({
      model: MODELS.sonnet,
      system: isHookParent ? HOOK_FOLLOWUP_SYSTEM : GENERIC_FOLLOWUP_SYSTEM,
      messages: [
        {
          role: "user",
          content: `Original question: "${questionText}"

Designer's answer: "${answer}"

Generate a follow-up question.`,
        },
      ],
      max_tokens: 200,
      temperature: 0.7,
    });

    const rawContent = message.content[0]?.type === "text" ? message.content[0].text : null;
    if (!rawContent) return null;
    const content = rawContent.replace(/```json\n?|\n?```/g, "").trim();

    const parsed = JSON.parse(content);
    if (!parsed.question) return null;

    // Arrivals/contrast gate (docs/17 §3): drop grievance/regret follow-ups
    // (return null → no follow-up is shown, a graceful degrade).
    if (!isArrivalSafe(parsed.question)) {
      console.info(`[generateFollowUp] arrivals gate dropped a ${isHookParent ? "hook" : "generic"} follow-up`);
      return null;
    }

    return {
      text: parsed.question,
      context: parsed.context || "",
      isHookFollowUp: isHookParent,
    };
  } catch (error) {
    console.error("[generateFollowUp] Error:", error);
    return null;
  }
}

/**
 * Generate a preview draft excerpt based on responses
 */
async function generatePreviewDraft(
  projectName: string,
  responses: Array<{ question: string; answer: string }>
): Promise<{ title: string; excerpt: string } | null> {
  if (!anthropic || responses.length < 3) {
    return null;
  }

  try {
    const message = await anthropic.messages.create({
      model: MODELS.sonnet,
      system: `${FOLIO_TONE}

You are writing a preview excerpt for an interior design editorial. Based on interview responses, generate a compelling title and first paragraph.

Guidelines:
- Title should be evocative, not literal (e.g., "Where Light Meets History" not "A Modern Renovation")
- Excerpt should be 2-3 sentences, magazine-quality prose
- Focus on the emotional and intentional aspects
- Write in third person
- If you quote the designer, use their exact words from the interview responses — do not polish or paraphrase into a quote.

Return JSON: { "title": "...", "excerpt": "..." }`,
      messages: [
        {
          role: "user",
          content: `Project: ${projectName}

Interview responses:
${responses.map((r, i) => `Q${i + 1}: ${r.question}\nA${i + 1}: ${r.answer}`).join("\n\n")}

Generate a title and excerpt preview.`,
        },
      ],
      max_tokens: 300,
      temperature: 0.8,
    });

    const rawContent = message.content[0]?.type === "text" ? message.content[0].text : null;
    if (!rawContent) return null;
    const content = rawContent.replace(/```json\n?|\n?```/g, "").trim();

    const parsed = JSON.parse(content);
    return {
      title: parsed.title || projectName,
      excerpt: parsed.excerpt || "",
    };
  } catch (error) {
    console.error("[generatePreviewDraft] Error:", error);
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    // Authenticate
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse and validate request
    const body = await request.json();
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { projectId, questionId, questionText: providedQuestionText, answer, inputMode } = parsed.data;

    // Find or create EditorialInterview for this project
    let interview = await prisma.editorialInterview.findUnique({
      where: { projectId },
    });

    if (!interview) {
      interview = await prisma.editorialInterview.create({
        data: {
          projectId,
          status: "IN_PROGRESS",
          selectedQuestionIds: [],
        },
      });
    }

    // Use provided question text, or fall back to generic
    const questionText = providedQuestionText || "Tell us about this project.";

    // Store answer in EditorialInterviewAnswer for durability
    // Try with questionText first; if the column doesn't exist yet, retry without it
    try {
      await prisma.editorialInterviewAnswer.create({
        data: {
          interviewId: interview.id,
          questionId,
          questionText, // Persist question text for editorial generation
          answerText: answer,
          inputModality: inputMode,
          questionSource: "base_question",
        },
      });
    } catch (insertError: any) {
      console.warn("[/api/interview/respond] Insert with questionText failed, retrying without:", insertError?.message);
      // Fallback: save without questionText (column may not exist in DB yet)
      await prisma.editorialInterviewAnswer.create({
        data: {
          interviewId: interview.id,
          questionId,
          answerText: answer,
          inputModality: inputMode,
        },
      });
    }

    // Read all answers for this interview to get count and for preview
    const allAnswers = await prisma.editorialInterviewAnswer.findMany({
      where: { interviewId: interview.id },
      orderBy: { createdAt: "asc" },
    });

    // AI-powered follow-up and preview — errors here should NOT fail the response
    // since the answer is already safely persisted in the database
    let followUpQuestion = null;
    let previewDraft = null;
    const shouldShowPreview = allAnswers.length >= 3;

    try {
      // Generate follow-up question
      const followUp = await generateFollowUp(questionText, answer, questionId);
      if (followUp?.text) {
        // Mint a stable id whose prefix lets the draft generator identify
        // hook-follow-up answers and splice them with the hook opener answer.
        const idPrefix = followUp.isHookFollowUp ? HOOK_FOLLOWUP_ID_PREFIX : 'followup-';
        followUpQuestion = {
          id: `${idPrefix}${randomUUID()}`,
          text: followUp.text,
          source: "ai-followup" as const,
          followUpTo: questionId,
          context: followUp.context || undefined,
        };
      }

      // Generate preview after 3+ responses
      if (shouldShowPreview) {
        const project = await prisma.project.findUnique({
          where: { id: projectId },
          select: { title: true },
        });

        previewDraft = await generatePreviewDraft(
          project?.title || "Your Project",
          allAnswers.map((r) => ({
            question: r.questionText || questionText,
            answer: r.answerText,
          }))
        );
      }
    } catch (aiError) {
      // Log but don't fail — the answer is already persisted
      console.error("[/api/interview/respond] AI generation error (non-fatal):", aiError);
    }

    return NextResponse.json({
      followUpQuestion,
      shouldShowPreview,
      previewDraft,
    });
  } catch (error: any) {
    const msg = error?.message || "Unknown error";
    console.error("[/api/interview/respond] Error:", msg, error);
    return NextResponse.json(
      { error: msg, detail: error?.code || null },
      { status: 500 }
    );
  }
}
