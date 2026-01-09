import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// [Edition System] Get/Update edition API

type RouteParams = {
  params: Promise<{ id: string }>;
};

export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;

    const edition = await prisma.editorialEdition.findUnique({
      where: { id },
      include: {
        contentInclusions: {
          orderBy: { rank: "asc" },
          include: {
            projectPost: {
              include: {
                project: {
                  select: {
                    id: true,
                    title: true,
                    designerId: true,
                    images: {
                      take: 1,
                      orderBy: { displayOrder: "asc" },
                      select: { url: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!edition) {
      return NextResponse.json(
        { error: "Edition not found" },
        { status: 404 }
      );
    }

    // Check access for non-published editions
    if (edition.status !== "PUBLISHED") {
      const session = await getServerSession(authOptions);
      if (session?.user?.role !== "ADMIN") {
        return NextResponse.json(
          { error: "Edition not found" },
          { status: 404 }
        );
      }
    }

    return NextResponse.json({ edition });
  } catch (error) {
    console.error("[API] GET /api/editions/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch edition" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id } = await params;
    const body = await request.json();

    // Validate edition exists
    const existing = await prisma.editorialEdition.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Edition not found" },
        { status: 404 }
      );
    }

    // Cannot edit published editions (only archive)
    if (existing.status === "PUBLISHED" && body.status !== "ARCHIVED") {
      return NextResponse.json(
        { error: "Cannot edit published editions. Archive first." },
        { status: 400 }
      );
    }

    // Allowed fields to update
    const allowedFields = [
      "title",
      "intro",
      "coverImageUrl",
      "projectPostIds",
      "featureIds",
      "status",
    ];

    const updateData: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    const updated = await prisma.editorialEdition.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ edition: updated });
  } catch (error) {
    console.error("[API] PATCH /api/editions/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to update edition" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id } = await params;

    // Check if edition exists
    const edition = await prisma.editorialEdition.findUnique({
      where: { id },
    });

    if (!edition) {
      return NextResponse.json(
        { error: "Edition not found" },
        { status: 404 }
      );
    }

    // Cannot delete published editions
    if (edition.status === "PUBLISHED") {
      return NextResponse.json(
        { error: "Cannot delete published editions. Archive first." },
        { status: 400 }
      );
    }

    // Delete content inclusions first
    await prisma.contentEditionInclusion.deleteMany({
      where: { editionId: id },
    });

    // Delete edition
    await prisma.editorialEdition.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[API] DELETE /api/editions/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to delete edition" },
      { status: 500 }
    );
  }
}
