export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: { productId: string } }
) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = Math.min(parseInt(searchParams.get("limit") || "10"), 50);
    const approvedOnly = searchParams.get("approvedOnly") !== "false"; // Default true

    // Fetch approved quote highlights for this product
    const where: any = {
      productId: params.productId,
      useCase: "PRODUCT_PAGE_INSIGHT",
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
            project: {
              select: {
                id: true,
                title: true,
                slug: true,
              },
            },
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
      (h) => h.interviewSession && h.interviewSession.project
    );

    // Transform to response format
    const insights = publishedHighlights.map((highlight) => ({
      id: highlight.id,
      quoteText: highlight.quoteText,
      designer: {
        id: highlight.interviewSession!.createdBy.id,
        name: highlight.interviewSession!.createdBy.name,
        profileImage: highlight.interviewSession!.createdBy.profileImage,
      },
      project: {
        id: highlight.interviewSession!.project!.id,
        title: highlight.interviewSession!.project!.title,
        slug: highlight.interviewSession!.project!.slug,
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
      insights,
      totalCount: insights.length,
    });
  } catch (error) {
    console.error("[products/insights] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}



