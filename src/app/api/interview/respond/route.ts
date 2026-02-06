export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { randomUUID } from "crypto";
import OpenAI from "openai";

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

// OpenAI client - only instantiate if API key is available
let openai: OpenAI | null = null;
if (process.env.OPENAI_API_KEY) {
  openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

/**
 * Generate a follow-up question based on the user's answer
 */
async function generateFollowUp(
  questionText: string,
  answer: string
): Promise<{ text: string; context: string } | null> {
  if (!openai) {
    return null;
  }

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are an interviewer for an interior design publication. Based on a designer's answer, generate one thoughtful follow-up question that will elicit a more detailed, quotable response.

Guidelines:
- Ask about the "why" behind their decisions
- Focus on emotion, intention, and process
- Avoid yes/no questions
- Keep questions concise (under 20 words)
- Questions should lead to answers a designer would be proud to publish

Return JSON: { "question": "...", "context": "..." }
The context is a brief lead-in phrase like "You mentioned the light." (optional, can be empty string)`,
        },
        {
          role: "user",
          content: `Original question: "${questionText}"

Designer's answer: "${answer}"

Generate a follow-up question.`,
        },
      ],
      response_format: { type: "json_object" },
      max_tokens: 150,
      temperature: 0.7,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return null;

    const parsed = JSON.parse(content);
    return {
      text: parsed.question || null,
      context: parsed.context || "",
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
  if (!openai || responses.length < 3) {
    return null;
  }

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are writing a preview excerpt for an interior design editorial. Based on interview responses, generate a compelling title and first paragraph.

Guidelines:
- Title should be evocative, not literal (e.g., "Where Light Meets History" not "A Modern Renovation")
- Excerpt should be 2-3 sentences, magazine-quality prose
- Focus on the emotional and intentional aspects
- Write in third person

Return JSON: { "title": "...", "excerpt": "..." }`,
        },
        {
          role: "user",
          content: `Project: ${projectName}

Interview responses:
${responses.map((r, i) => `Q${i + 1}: ${r.question}\nA${i + 1}: ${r.answer}`).join("\n\n")}

Generate a title and excerpt preview.`,
        },
      ],
      response_format: { type: "json_object" },
      max_tokens: 300,
      temperature: 0.8,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return null;

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

    // Store answer in EditorialInterviewAnswer for durability
    await prisma.editorialInterviewAnswer.create({
      data: {
        interviewId: interview.id,
        questionId,
        answerText: answer,
        inputModality: inputMode,
        questionSource: "base_question",
      },
    });

    // Read all answers for this interview to get count and for preview
    const allAnswers = await prisma.editorialInterviewAnswer.findMany({
      where: { interviewId: interview.id },
      orderBy: { createdAt: "asc" },
    });

    // Use provided question text, or fall back to generic
    const questionText = providedQuestionText || "Tell us about this project.";

    // Generate follow-up question
    let followUpQuestion = null;
    const followUp = await generateFollowUp(questionText, answer);
    if (followUp?.text) {
      followUpQuestion = {
        id: `followup-${randomUUID()}`,
        text: followUp.text,
        source: "ai-followup" as const,
        followUpTo: questionId,
        context: followUp.context || undefined,
      };
    }

    // Generate preview after 3+ responses
    const shouldShowPreview = allAnswers.length >= 3;
    let previewDraft = null;

    if (shouldShowPreview) {
      // Get project title for the preview
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { title: true },
      });

      previewDraft = await generatePreviewDraft(
        project?.title || "Your Project",
        allAnswers.map((r) => ({
          question: questionText, // Best effort — question text not stored in DB
          answer: r.answerText,
        }))
      );
    }

    return NextResponse.json({
      followUpQuestion,
      shouldShowPreview,
      previewDraft,
    });
  } catch (error) {
    console.error("[/api/interview/respond] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
