import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// [Edition System] List editions API

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const cadence = searchParams.get("cadence");
    const status = searchParams.get("status");
    const limit = parseInt(searchParams.get("limit") ?? "20", 10);
    const offset = parseInt(searchParams.get("offset") ?? "0", 10);

    const where: Record<string, unknown> = {};

    // Filter by cadence
    if (cadence && ["WEEKLY", "MONTHLY", "QUARTERLY", "ANNUAL"].includes(cadence)) {
      where.cadence = cadence;
    }

    // Filter by status (default to PUBLISHED for public)
    if (status && ["DRAFT", "REVIEW", "PUBLISHED", "ARCHIVED"].includes(status)) {
      // Only admins can see non-published editions
      const session = await getServerSession(authOptions);
      if (session?.user?.role === "ADMIN" || status === "PUBLISHED") {
        where.status = status;
      } else {
        where.status = "PUBLISHED";
      }
    } else {
      where.status = "PUBLISHED";
    }

    const [editions, total] = await Promise.all([
      prisma.editorialEdition.findMany({
        where,
        orderBy: { periodStart: "desc" },
        take: Math.min(limit, 100),
        skip: offset,
        select: {
          id: true,
          slug: true,
          cadence: true,
          periodStart: true,
          periodEnd: true,
          title: true,
          intro: true,
          coverImageUrl: true,
          projectPostIds: true,
          featureIds: true,
          includedEditionIds: true,
          status: true,
          publishedAt: true,
          metrics: true,
          createdAt: true,
        },
      }),
      prisma.editorialEdition.count({ where }),
    ]);

    return NextResponse.json({
      editions,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + editions.length < total,
      },
    });
  } catch (error) {
    console.error("[API] GET /api/editions error:", error);
    return NextResponse.json(
      { error: "Failed to fetch editions" },
      { status: 500 }
    );
  }
}
