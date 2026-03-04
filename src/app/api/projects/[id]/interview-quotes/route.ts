export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { assertProjectView } from "@/lib/authz/access";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    await assertProjectView(session.user.id, params.id);

    const searchParams = request.nextUrl.searchParams;
    const limit = Math.min(parseInt(searchParams.get("limit") || "10"), 50);
    const approvedOnly = searchParams.get("approvedOnly") !== "false"; // Default true

    // Fetch approved quote highlights for this project
    const where: any = {
      interviewSession: {
        projectId: params.id,
      },
      useCase: "EDITORIAL_PULLQUOTE",
    };

    if (approvedOnly) {
      where.approvedByDesigner = true;
    }

    const highlights = await prisma.quoteHighlight.findMany({
      where,
      orderBy: {
        score: "desc",
      },
      take: limit,
      select: {
        id: true,
        quoteText: true,
        startMs: true,
        endMs: true,
        score: true,
        interviewSession: {
          select: {
            id: true,
            recordedAt: true,
            createdBy: {
              select: {
                id: true,
                name: true,
                profileImage: true,
              },
            },
          },
        },
      },
    });

    // Filter to only published interviews
    const publishedHighlights = highlights.filter(
      (h) => h.interviewSession
    );

    // Transform to response format
    const quotes = publishedHighlights.map((highlight) => ({
      id: highlight.id,
      quoteText: highlight.quoteText,
      designer: {
        id: highlight.interviewSession!.createdBy.id,
        name: highlight.interviewSession!.createdBy.name,
        profileImage: highlight.interviewSession!.createdBy.profileImage,
      },
      interviewSession: {
        id: highlight.interviewSession!.id,
        recordedAt: highlight.interviewSession!.recordedAt,
      },
      startMs: highlight.startMs,
      endMs: highlight.endMs,
    }));

    return NextResponse.json({
      ok: true,
      quotes,
      totalCount: quotes.length,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("[projects/interview-quotes] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}



