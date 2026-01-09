export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import { prisma } from "@/lib/prisma";
import { assertProjectView } from "@/lib/authz/access";

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

    // Extract interview data - normalize answers and followUps to consistent format
    const normalizeQA = (items: any[]): Array<{ q: string; a: string }> => {
      return (items || []).map((item: any) => ({
        q: item.question || item.q || item.questionId || item.prompt || '',
        a: item.answer || item.a || '',
      })).filter((qa: any) => qa.q || qa.a);
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
        sections: (b?.data?.sections || b?.sections || []).slice(0, 3), // Preview first 3 sections
      };
    });

    return NextResponse.json({
      interview: interviewData,
      drafts: versions,
    });
  } catch (e: any) {
    console.error("[drafts] GET failed", { err: e?.message });
    return NextResponse.json(
      { error: "Failed to fetch drafts data" },
      { status: 500 }
    );
  }
}

