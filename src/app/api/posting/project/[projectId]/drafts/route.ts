export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import { prisma } from "@/lib/prisma";
import { assertProjectView } from "@/lib/authz/access";
import { hasNewProductsSinceGeneration } from "@/lib/posting/hasNewProductsSinceGeneration";

export async function GET(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const projectId = params.projectId;
    await assertProjectView(session.user.id, projectId);

    // Get interview data from the latest ProjectPost's provenance
    const latestPost = await prisma.projectPost.findFirst({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        provenance: true,
        updatedAt: true,
      },
    });

    const provenance = (latestPost?.provenance as any) || {};
    const interview = provenance.interview || {};
    const payload = interview.payload || {};

    // Build a recovery map from EditorialInterviewAnswer so we can restore
    // missing question text when provenance was overwritten without prompts
    // (e.g. an older Save path that posted empty `question` fields and the
    // server auto-assigned `auto-N` ids with empty prompt).
    const editorialInterview = await prisma.editorialInterview.findUnique({
      where: { projectId },
      select: {
        answers: {
          orderBy: { createdAt: "asc" },
          select: {
            questionId: true,
            questionText: true,
            answerText: true,
            isFollowUp: true,
          },
        },
      },
    });

    const questionTextByQuestionId = new Map<string, string>();
    const questionTextByAnswerText = new Map<string, string>();
    for (const a of editorialInterview?.answers ?? []) {
      if (a.questionText) {
        if (a.questionId) questionTextByQuestionId.set(a.questionId, a.questionText);
        if (a.answerText) questionTextByAnswerText.set(a.answerText.trim(), a.questionText);
      }
    }

    // Extract interview data - normalize answers and followUps to consistent format.
    // Preserves questionId/section/isFollowUp and recovers question text from
    // EditorialInterviewAnswer when the provenance copy is empty.
    const normalizeQA = (items: any[]) => {
      return (items || []).map((item: any) => {
        let q = item.question || item.q || item.prompt || "";
        const a = item.answer || item.a || "";
        const questionId = item.questionId || item.id || "";
        if (!q && questionId && questionTextByQuestionId.has(questionId)) {
          q = questionTextByQuestionId.get(questionId)!;
        }
        if (!q && a && questionTextByAnswerText.has(a.trim())) {
          q = questionTextByAnswerText.get(a.trim())!;
        }
        return {
          q,
          a,
          isFeatured: !!item.isFeatured,
          questionId,
          section: item.section || "",
          isFollowUp: !!item.isFollowUp,
        };
      }).filter((qa: any) => qa.q || qa.a);
    };

    const interviewData = {
      id: latestPost?.id || null,
      status: interview.status?.phase || "idle",
      answers: normalizeQA(payload.answers || interview.answers || []),
      followUps: normalizeQA(payload.followups || interview.followUps || []),
      payload: {
        answers: normalizeQA(payload.answers || interview.answers || []),
        followups: normalizeQA(payload.followups || interview.followUps || []),
        imageOrder: payload.imageOrder || interview.imageOrder || [],
        selectedQuestionIds: payload.selectedQuestionIds || interview.selectedQuestionIds || [],
      },
      updatedAt: latestPost?.updatedAt?.toISOString() || new Date().toISOString(),
    };

    // Get last 5 ProjectPost drafts
    const drafts = await prisma.projectPost.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        createdAt: true,
        status: true,
        slug: true,
        expandedBlocks: true,
      },
    });

    const versions = drafts.map((d) => {
      const b = (d.expandedBlocks as any) ?? {};
      return {
        id: d.id,
        createdAt: d.createdAt.toISOString(),
        status: d.status,
        slug: d.slug,
        lead: b?.lead ?? null,
        sections: (b?.galleryChapters || []).flatMap((ch: any) =>
          (ch.body || []).map((para: string) => ({
            type: "narrative",
            body: para,
            chapterTitle: ch.title,
          }))
        ).slice(0, 3),
      };
    });

    // Check for new products since last generation
    const newProductsInfo = await hasNewProductsSinceGeneration(projectId);

    return NextResponse.json({
      interview: interviewData,
      drafts: versions,
      newProducts: {
        hasNew: newProductsInfo.hasNew,
        count: newProductsInfo.newCount,
      },
    });
  } catch (e: any) {
    console.error("[drafts] GET failed", { err: e?.message });
    return NextResponse.json(
      { error: "Failed to fetch drafts data" },
      { status: 500 }
    );
  }
}

