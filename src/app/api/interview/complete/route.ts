import { legacyInterviewBoundary } from '@/lib/spotlight/legacyBoundary';
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import { assertProjectWrite } from "@/lib/authz/access";
import { z } from "zod";
import { syncEditorialAnswersToProvenance } from "@/lib/editorial/syncEditorialAnswersToProvenance";

/**
 * POST /api/interview/complete
 *
 * Called when InterviewFlow finishes all questions.
 * 1. Syncs EditorialInterviewAnswer data → ProjectPost.provenance
 *    (so all existing consumers — drafts, verify, followups, generation — see the data)
 * 2. Returns formatted answers for the generation endpoint's answersOverride
 */

const RequestSchema = z.object({
  projectId: z.string().min(1),
});

export async function POST(request: NextRequest) {
  const spotlightBoundary = await legacyInterviewBoundary(request);
  if (spotlightBoundary) return spotlightBoundary;

  try {
    // Authenticate
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse request
    const body = await request.json();
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { projectId } = parsed.data;

    // Completion writes canonical evidence, so view access is insufficient.
    await assertProjectWrite(session.user.id, projectId);

    // Sync answers to provenance and get formatted overrides
    const result = await syncEditorialAnswersToProvenance(projectId);

    if (result.answerCount === 0) {
      return NextResponse.json(
        { error: "No interview answers found. Please complete the interview first." },
        { status: 400 }
      );
    }

    console.log("[/api/interview/complete] Synced answers to provenance", {
      projectId,
      answerCount: result.answerCount,
      baseAnswers: result.answers.length,
      followups: result.followups.length,
    });

    return NextResponse.json({
      ok: true,
      answerCount: result.answerCount,
      answers: result.answers,
      followups: result.followups,
    });
  } catch (error: any) {
    if (error?.status === 409 || error?.code === 'P2002') {
      return NextResponse.json({ error: error.message, code: 'INTERVIEW_CONFLICT' }, { status: 409 });
    }
    if (error?.message === 'NotFound') {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    if (error?.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("[/api/interview/complete] Error:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
