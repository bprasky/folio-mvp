export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import { z } from "zod";
import { randomUUID } from "crypto";
import OpenAI from "openai";

/**
 * POST /api/interview/generate-draft
 *
 * Generate final editorial draft from interview session.
 */

const RequestSchema = z.object({
  sessionId: z.string().min(1),
});

// OpenAI client
let openai: OpenAI | null = null;
if (process.env.OPENAI_API_KEY) {
  openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

// Editorial block types (matching existing schema)
interface EditorialBlock {
  type: "headline" | "pullquote" | "paragraph" | "subhead" | "image";
  content: string;
  imageId?: string;
}

/**
 * Generate editorial draft from interview responses
 */
async function generateEditorial(
  projectName: string,
  responses: Array<{ question: string; answer: string }>
): Promise<{ title: string; blocks: EditorialBlock[] }> {
  if (!openai) {
    // Return basic draft if AI unavailable
    return {
      title: projectName,
      blocks: [
        { type: "headline", content: projectName },
        ...responses.map((r) => ({
          type: "paragraph" as const,
          content: r.answer,
        })),
      ],
    };
  }

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an editor for a prestigious interior design publication. Create a polished editorial from designer interview responses.

Structure:
1. A compelling, evocative headline
2. An opening paragraph that sets the scene
3. 2-3 body sections, each with a subhead and 1-2 paragraphs
4. 1-2 pull quotes from the designer's words (direct quotes)
5. A closing thought

Return JSON array of blocks:
[
  { "type": "headline", "content": "..." },
  { "type": "paragraph", "content": "..." },
  { "type": "subhead", "content": "..." },
  { "type": "pullquote", "content": "..." },
  ...
]

Guidelines:
- Headlines should be evocative, not literal
- Pull quotes should be the designer's actual words, slightly polished
- Write in third person
- Focus on intention, emotion, and craft
- Magazine-quality prose`,
        },
        {
          role: "user",
          content: `Project: ${projectName}

Interview responses:
${responses.map((r, i) => `Q: ${r.question}\nA: ${r.answer}`).join("\n\n")}

Generate the editorial.`,
        },
      ],
      response_format: { type: "json_object" },
      max_tokens: 2000,
      temperature: 0.7,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error("No content returned");

    const parsed = JSON.parse(content);
    const blocks = Array.isArray(parsed) ? parsed : parsed.blocks || [];

    // Extract title from headline block
    const headlineBlock = blocks.find(
      (b: EditorialBlock) => b.type === "headline"
    );
    const title = headlineBlock?.content || projectName;

    return { title, blocks };
  } catch (error) {
    console.error("[generateEditorial] Error:", error);
    return {
      title: projectName,
      blocks: [
        { type: "headline", content: projectName },
        ...responses.map((r) => ({
          type: "paragraph" as const,
          content: r.answer,
        })),
      ],
    };
  }
}

// In-memory session storage (matches respond route)
const sessionResponses = new Map<
  string,
  Array<{ questionId: string; questionText: string; answer: string }>
>();

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

    const { sessionId } = parsed.data;

    // Get responses for this session
    const responses = sessionResponses.get(sessionId) || [];

    if (responses.length === 0) {
      return NextResponse.json(
        { error: "No responses found for session" },
        { status: 400 }
      );
    }

    // Generate the editorial
    const { title, blocks } = await generateEditorial(
      "Your Project", // Would get actual project name
      responses.map((r) => ({
        question: r.questionText,
        answer: r.answer,
      }))
    );

    // Generate a draft ID
    const draftId = `draft-${randomUUID()}`;

    // Clean up session data
    sessionResponses.delete(sessionId);

    return NextResponse.json({
      draftId,
      title,
      blocks,
      status: "ready" as const,
    });
  } catch (error) {
    console.error("[/api/interview/generate-draft] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
