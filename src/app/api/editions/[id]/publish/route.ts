import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { logPassiveEvent } from "@/lib/analytics";

// [Edition System] Publish edition API

type RouteParams = {
  params: Promise<{ id: string }>;
};

export async function POST(
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

    // Get edition
    const edition = await prisma.editorialEdition.findUnique({
      where: { id },
    });

    if (!edition) {
      return NextResponse.json(
        { error: "Edition not found" },
        { status: 404 }
      );
    }

    // Check if already published
    if (edition.status === "PUBLISHED") {
      return NextResponse.json(
        { error: "Edition is already published" },
        { status: 400 }
      );
    }

    // Check if archived
    if (edition.status === "ARCHIVED") {
      return NextResponse.json(
        { error: "Cannot publish archived editions" },
        { status: 400 }
      );
    }

    // Validate edition has content
    const contentCount = (edition.projectPostIds?.length ?? 0) + (edition.featureIds?.length ?? 0);
    if (contentCount === 0) {
      return NextResponse.json(
        { error: "Cannot publish edition with no content" },
        { status: 400 }
      );
    }

    // Publish the edition
    const publishedAt = new Date();
    const updated = await prisma.editorialEdition.update({
      where: { id },
      data: {
        status: "PUBLISHED",
        publishedAt,
        metrics: {
          ...(edition.metrics as Record<string, unknown> ?? {}),
          publishedAt: publishedAt.toISOString(),
          publishedBy: session.user.id,
        },
      },
    });

    // Notify stakeholders (designers whose work is included)
    if (edition.projectPostIds && edition.projectPostIds.length > 0) {
      const projectPosts = await prisma.projectPost.findMany({
        where: { id: { in: edition.projectPostIds } },
        include: {
          project: {
            select: { designerId: true, ownerId: true },
          },
        },
      });

      const notifications = projectPosts.flatMap((post) => {
        const notifs: Promise<void>[] = [];
        const payload = {
          editionId: edition.id,
          editionSlug: edition.slug,
          editionTitle: edition.title,
          projectPostId: post.id,
        };

        if (post.project?.designerId) {
          notifs.push(
            logPassiveEvent({
              type: "editorial_edition_published" as any,
              projectId: post.projectId,
              actorId: post.project.designerId,
              payload,
            })
          );
        }

        if (post.project?.ownerId && post.project.ownerId !== post.project.designerId) {
          notifs.push(
            logPassiveEvent({
              type: "editorial_edition_published" as any,
              projectId: post.projectId,
              actorId: post.project.ownerId,
              payload,
            })
          );
        }

        return notifs;
      });

      await Promise.all(notifications);
    }

    return NextResponse.json({
      success: true,
      edition: updated,
    });
  } catch (error) {
    console.error("[API] POST /api/editions/[id]/publish error:", error);
    return NextResponse.json(
      { error: "Failed to publish edition" },
      { status: 500 }
    );
  }
}
