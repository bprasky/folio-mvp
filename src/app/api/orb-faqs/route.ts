import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const nodeId = searchParams.get("nodeId");

    if (!nodeId) {
      return NextResponse.json(
        { error: "nodeId query parameter is required" },
        { status: 400 }
      );
    }

    const faqs = await prisma.orbQuestion.findMany({
      where: {
        nodeId: nodeId,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 10,
      select: {
        id: true,
        question: true,
        answer: true,
      },
    });

    return NextResponse.json({ faqs });
  } catch (error) {
    console.error("[orb-faqs] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch FAQs" },
      { status: 500 }
    );
  }
}

