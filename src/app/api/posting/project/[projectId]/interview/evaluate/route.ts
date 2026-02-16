export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import { prisma } from "@/lib/prisma";
import { assertProjectView } from "@/lib/authz/access";
import { callLLM } from "@/lib/posting/llmClient";
import { cid } from "@/lib/utils/correlation";
import { z } from "zod";

/**
 * Lightweight background evaluation endpoint.
 * Uses gpt-4o-mini to pre-evaluate whether in-progress answers
 * cover or partially address remaining questions. Results let the
 * frontend pre-compute morphed questions so they appear instantly
 * on submit.
 */

const EvaluateRequestSchema = z.object({
  answerSummaries: z.array(z.object({
    questionId: z.string(),
    summary: z.string().max(250),
  })),
  remainingQuestions: z.array(z.object({
    id: z.string(),
    question: z.string().max(250),
  })),
});

const OPENAI_ENABLED =
  !!process.env.OPENAI_API_KEY && process.env.OPENAI_ENABLED !== "false";

const SYSTEM_PROMPT = `You evaluate whether a designer's interview answers already cover upcoming questions. For each remaining question, decide:
- "none": answers don't touch this topic
- "covered": fully addressed, nothing left to ask
- "morphed": partially addressed — rewrite to reference what was said and ask about the new angle

Morphed questions should be under 200 characters, reference prior answers ("You mentioned X..."), and bridge to the new context.

Return JSON: { "updates": [{ "id": string, "status": "none"|"covered"|"morphed", "morphedText"?: string }] }

Only include questions where status is "covered" or "morphed". Omit "none" entries to keep responses compact. Most questions will be unaffected.`;

export async function POST(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  const _cid = cid('evaluate');
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const projectId = params.projectId;
    await assertProjectView(session.user.id, projectId);

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { ownerId: true, designerId: true },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const isOwner = project.ownerId === session.user.id || project.designerId === session.user.id;
    if (!isOwner && session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    let validated;
    try {
      validated = EvaluateRequestSchema.parse(body);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return NextResponse.json(
          { error: "validation_failed", issues: err.issues },
          { status: 422 }
        );
      }
      throw err;
    }

    if (!validated.answerSummaries.length || !validated.remainingQuestions.length) {
      return NextResponse.json({ ok: true, updates: [] }, { status: 200 });
    }

    if (!OPENAI_ENABLED) {
      return NextResponse.json({ ok: true, updates: [] }, { status: 200 });
    }

    // Build compact prompt — no images, no product context, just text
    let prompt = `Designer's answers so far:\n`;
    for (const a of validated.answerSummaries) {
      prompt += `- [${a.questionId}]: ${a.summary}\n`;
    }
    prompt += `\nRemaining questions:\n`;
    for (const q of validated.remainingQuestions) {
      prompt += `- [${q.id}]: "${q.question}"\n`;
    }
    prompt += `\nReturn only questions that are "covered" or "morphed". Omit unaffected questions.`;

    const modelName = 'gpt-4o-mini';

    const openai = await import("openai").then((m) =>
      new m.default({ apiKey: process.env.OPENAI_API_KEY })
    );

    const llmResult = await callLLM(
      async () => {
        return await openai.chat.completions.create({
          model: modelName,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: prompt },
          ],
          temperature: 0.3,
          max_tokens: 400,
          response_format: { type: "json_object" },
        });
      },
      { modelName, maxRetries: 1, baseDelayMs: 200, contextHint: `evaluate:${projectId}` }
    );

    if (!llmResult.ok) {
      console.warn('[evaluate] llm_fail', { _cid, code: llmResult.code });
      return NextResponse.json({ ok: true, updates: [] }, { status: 200 });
    }

    const raw = llmResult.data.choices?.[0]?.message?.content || "{}";
    let json: any;
    try {
      json = JSON.parse(raw);
    } catch {
      console.warn('[evaluate] json_parse_fail', { _cid });
      return NextResponse.json({ ok: true, updates: [] }, { status: 200 });
    }

    const updates = Array.isArray(json.updates)
      ? json.updates
          .filter((u: any) => u?.id && (u.status === 'covered' || u.status === 'morphed'))
          .map((u: any) => ({
            id: String(u.id),
            status: u.status as 'covered' | 'morphed',
            morphedText: u.status === 'morphed' && typeof u.morphedText === 'string'
              ? u.morphedText.trim().slice(0, 200)
              : undefined,
          }))
      : [];

    console.info('[evaluate] done', { _cid, updateCount: updates.length });
    return NextResponse.json({ ok: true, updates }, { status: 200 });
  } catch (error: any) {
    if (error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("[evaluate] Error:", error);
    // Non-critical endpoint — degrade gracefully
    return NextResponse.json({ ok: true, updates: [] }, { status: 200 });
  }
}
